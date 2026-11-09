"""Train and evaluate the forecast models.

    python -m floodcrew.train --data synthetic        # simulated Tees data (works offline)
    python -m floodcrew.train --data data/tees_hourly.csv

For each gauge it trains two models on the first 75% of time and tests on the last 25%:
  * Ridge regression (simple, explainable: every weight can be shown to the officer)
  * Gradient boosting (non-linear, usually more accurate)
and compares both with persistence ("the level will not change").
"""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, precision_score, r2_score, recall_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .config import GAUGES, TRAIN_FRACTION
from .features import FEATURES, add_soil_wetness, build
from .synthetic import simulate

OUT = Path(__file__).resolve().parent.parent / "models"


def load(data: str) -> pd.DataFrame:
    if data == "synthetic":
        df = simulate()
    else:
        df = pd.read_csv(data, index_col=0, parse_dates=True)
    return add_soil_wetness(df)


def warning_levels(df: pd.DataFrame) -> dict:
    """Warning level per gauge = level exceeded only 0.7% of the time (replace with official EA thresholds if known)."""
    return {g["id"]: round(float(df[g["id"]].quantile(0.993)) * 20) / 20 for g in GAUGES}


def main(data: str):
    df = load(data)
    split = df.index[int(len(df) * TRAIN_FRACTION)]
    warn = warning_levels(df)
    OUT.mkdir(exist_ok=True)
    report, rows = {"data": data, "split": str(split), "warn": warn, "gauges": {}}, []
    for g in GAUGES:
        gid = g["id"]
        X, y = build(df, gid)
        tr, te = X.index < split, X.index >= split
        ridge = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(X[tr], y[tr])
        gbm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.06, random_state=0).fit(X[tr], y[tr])
        sigma = float(np.std(y[tr] - ridge.predict(X[tr])))
        truth, persist = y[te].to_numpy(), X.loc[te, "level_now"].to_numpy()
        res = {"n_train": int(tr.sum()), "n_test": int(te.sum()), "sigma": sigma}
        actual_warn = truth >= warn[gid]
        for name, pred in [("ridge", ridge.predict(X[te])), ("gbm", gbm.predict(X[te])), ("persistence", persist)]:
            if name == "persistence":
                alarm = pred >= warn[gid]
            else:
                alarm = (1 - norm.cdf((warn[gid] - pred) / sigma)) >= 0.5
            res[name] = {
                "mae_cm": round(mean_absolute_error(truth, pred) * 100, 2),
                "rmse_cm": round(mean_squared_error(truth, pred) ** 0.5 * 100, 2),
                "r2": round(r2_score(truth, pred), 4),
                "warning_precision": round(precision_score(actual_warn, alarm, zero_division=0), 3),
                "warning_recall": round(recall_score(actual_warn, alarm, zero_division=0), 3),
            }
            rows.append([g["name"], name, res[name]["mae_cm"], res[name]["r2"], res[name]["warning_precision"], res[name]["warning_recall"]])
        coefs = ridge[-1].coef_
        res["ridge_weights"] = dict(zip(FEATURES, [round(float(c), 4) for c in coefs]))
        report["gauges"][gid] = res
        joblib.dump({"ridge": ridge, "gbm": gbm, "sigma": sigma, "warn": warn[gid]}, OUT / f"{gid}.joblib")
    (OUT / "metrics.json").write_text(json.dumps(report, indent=2))
    table = pd.DataFrame(rows, columns=["gauge", "model", "MAE (cm)", "R2", "warning precision", "warning recall"])
    print(table.to_string(index=False))
    print(f"\nTrain/test split at {split}. Models and metrics saved to {OUT}/")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="synthetic", help="'synthetic' or path to tees_hourly.csv")
    main(p.parse_args().data)
