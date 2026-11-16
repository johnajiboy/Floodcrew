"""Train and evaluate the forecast models.

    python -m floodcrew.train                         # real EA data in data/tees_hourly.csv (from fetch_ea)
    python -m floodcrew.train --data synthetic        # simulated Tees data (works offline)

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

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "models"
REAL = ROOT / "data" / "tees_hourly.csv"
DEFAULT_DATA = "data/tees_hourly.csv" if REAL.exists() else "synthetic"


def update_metrics(section: str, values: dict):
    """Add one section (e.g. 'evaluation', 'ice') to models/metrics.json, keeping what train wrote."""
    path = OUT / "metrics.json"
    report = json.loads(path.read_text()) if path.exists() else {}
    report[section] = values
    OUT.mkdir(exist_ok=True)
    path.write_text(json.dumps(report, indent=2))


def load(data: str) -> pd.DataFrame:
    if data == "synthetic":
        df = simulate()
        df.attrs["synthetic"] = True
    else:
        path = Path(data)
        df = pd.read_csv(path if path.is_absolute() or path.exists() else ROOT / path, index_col=0, parse_dates=True)
    return add_soil_wetness(df)


def warning_levels(df: pd.DataFrame) -> dict:
    """Warning level per gauge. Real data: the official EA flood alert level (config ea_alert, top of normal range).
    Simulated data is on a different scale, so there it is the level exceeded only 0.7% of the time."""
    if df.attrs.get("synthetic"):
        return {g["id"]: round(float(df[g["id"]].quantile(0.993)) * 20) / 20 for g in GAUGES}
    return {g["id"]: g["ea_alert"] for g in GAUGES}


def main(data: str):
    df = load(data)
    split = df.index[int(len(df) * TRAIN_FRACTION)]
    warn = warning_levels(df)
    OUT.mkdir(exist_ok=True)
    report = {"data": data, "split": str(split), "warn": warn,
              "warn_source": "simulated: 99.3rd percentile" if df.attrs.get("synthetic") else "official EA flood alert level (top of normal range)",
              "gauges": {}}
    rows = []
    for g in GAUGES:
        gid = g["id"]
        X, y = build(df, gid)
        tr, te = X.index < split, X.index >= split
        ridge = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(X[tr], y[tr])
        gbm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.06, random_state=0).fit(X[tr], y[tr])
        sigma = float(np.std(y[tr] - ridge.predict(X[tr])))
        truth, persist = y[te].to_numpy(), X.loc[te, "level_now"].to_numpy()
        actual_warn = truth >= warn[gid]
        res = {"n_train": int(tr.sum()), "n_test": int(te.sum()), "sigma": sigma, "warning_hours_test": int(actual_warn.sum())}
        for name, pred in [("ridge", ridge.predict(X[te])), ("gbm", gbm.predict(X[te])), ("persistence", persist)]:
            if name == "persistence":
                alarm = pred >= warn[gid]
            else:
                alarm = (1 - norm.cdf((warn[gid] - pred) / sigma)) >= 0.5
            res[name] = {
                "mae_cm": round(mean_absolute_error(truth, pred) * 100, 2),
                "rmse_cm": round(mean_squared_error(truth, pred) ** 0.5 * 100, 2),
                "r2": round(r2_score(truth, pred), 4),
                # no hours above the warning level in the test period -> recall cannot be measured (None, shown as n/a)
                "warning_precision": round(precision_score(actual_warn, alarm, zero_division=0), 3) if alarm.any() else None,
                "warning_recall": round(recall_score(actual_warn, alarm, zero_division=0), 3) if actual_warn.any() else None,
            }
            rows.append([g["name"], name, res[name]["mae_cm"], res[name]["r2"], res[name]["warning_precision"], res[name]["warning_recall"]])
        coefs = ridge[-1].coef_
        res["ridge_weights"] = dict(zip(FEATURES, [round(float(c), 4) for c in coefs]))
        report["gauges"][gid] = res
        joblib.dump({"ridge": ridge, "gbm": gbm, "sigma": sigma, "warn": warn[gid]}, OUT / f"{gid}.joblib")
    (OUT / "metrics.json").write_text(json.dumps(report, indent=2))
    table = pd.DataFrame(rows, columns=["gauge", "model", "MAE (cm)", "R2", "warning precision", "warning recall"])
    print(table.to_string(index=False, na_rep="n/a"))
    print("Warning levels (m): " + ", ".join(f"{g['name']} {warn[g['id']]:.2f}" for g in GAUGES) + f"  [{report['warn_source']}]")
    print(f"\nTrain/test split at {split}. Models and metrics saved to {OUT}/")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=DEFAULT_DATA, help="path to tees_hourly.csv (default when downloaded) or 'synthetic'")
    main(p.parse_args().data)
