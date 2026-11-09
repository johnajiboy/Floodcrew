"""FloodCrew API: serves forecasts, site risk and the recommended crew plan.

    uvicorn api:app --reload
    open http://127.0.0.1:8000/docs
"""
import json
from pathlib import Path

import joblib
from fastapi import FastAPI, Query

from floodcrew.config import CREWS, GAUGES
from floodcrew.features import build
from floodcrew.plan import approvals, plan, site_risk
from floodcrew.train import OUT, load, warning_levels

app = FastAPI(title="FloodCrew IDSS")
DATA = "synthetic"   # change to "data/tees_hourly.csv" after downloading real data
DF = load(DATA)
WARN = warning_levels(DF)
MODELS = {g["id"]: joblib.load(OUT / f"{g['id']}.joblib") for g in GAUGES}


def forecasts(at: int, extra_rain: float):
    out = {}
    for g in GAUGES:
        X, _ = build(DF, g["id"], extra_rain=extra_rain)
        x = X.iloc[[min(at, len(X) - 1)]]
        m = MODELS[g["id"]]
        out[g["id"]] = {"time": str(x.index[0]), "now": float(x["level_now"].iloc[0]), "pred": float(m["ridge"].predict(x)[0]),
                        "pred_gbm": float(m["gbm"].predict(x)[0]), "sigma": m["sigma"], "warning_level": m["warn"]}
    return out


@app.get("/metrics")
def metrics():
    return json.loads((OUT / "metrics.json").read_text())


@app.get("/forecast")
def forecast(hour_index: int = Query(-1, description="row in the hourly table; -1 = latest"), extra_rain_mm: float = 0):
    return forecasts(hour_index if hour_index >= 0 else len(DF) - 10, extra_rain_mm)


@app.get("/plan")
def get_plan(hour_index: int = -1, extra_rain_mm: float = 0, crews: int = 5, protected_weight: float = 2.0,
             confidence_auto: float = 0.7, road_speed_kmh: float = 30):
    fc = forecasts(hour_index if hour_index >= 0 else len(DF) - 10, extra_rain_mm)
    risks = site_risk(fc, WARN, protected_weight)
    team = [{"id": f"c{i}", "name": CREWS[i], "at": "depot"} for i in range(crews)]
    moves = approvals(plan(risks, team, road_speed_kmh), risks, confidence_auto)
    return {"forecast": fc, "site_risk": risks, "moves": moves}
