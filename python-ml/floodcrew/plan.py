"""Decision logic: forecast -> site risk (rules) -> optimal crew assignment (Hungarian algorithm) -> approval rules."""
from math import hypot

import numpy as np
from scipy.optimize import linear_sum_assignment
from scipy.stats import norm

from .config import (CONFIDENCE_AUTO, DEPOT, MAP_KM_PER_UNIT, MIN_SLOT_PROB, PROTECTED_WEIGHT, ROAD_SPEED_KMH,
                     SITES, TRAVEL_WEIGHT)

SITE = {s["id"]: s for s in SITES}


def pos(place):
    return DEPOT if place == "depot" else SITE[place]


def travel_minutes(a, b, speed=ROAD_SPEED_KMH):
    pa, pb = pos(a), pos(b)
    return hypot(pa["x"] - pb["x"], pa["y"] - pb["y"]) * MAP_KM_PER_UNIT / speed * 60


def site_risk(forecasts: dict, warn: dict, protected_weight: float = 2.0):
    """forecasts[gauge] = {"pred": metres, "sigma": metres}. Returns sites sorted by risk score."""
    out = []
    for s in SITES:
        f = forecasts[s["gauge"]]
        thr = warn[s["gauge"]] + s["offset"]
        p = float(1 - norm.cdf((thr - f["pred"]) / f["sigma"]))
        impact = s["homes"] + (PROTECTED_WEIGHT * protected_weight if s["protected"] else 0)
        out.append({"site": s["id"], "name": s["name"], "p": p, "impact": impact, "score": p * impact, "threshold": thr,
                    "reason": f"forecast {f['pred']:.2f} m vs site flood level {thr:.2f} m"})
    return sorted(out, key=lambda r: -r["score"])


def plan(risks, crews, speed=ROAD_SPEED_KMH, covered=None):
    """crews: list of {"id","name","at"}. Maximise protected value minus travel time (exact assignment).
    covered: {site_id: number of crews already there or on the way} - those slots are skipped."""
    covered = covered or {}
    slots = []
    for r in risks:
        if r["p"] > MIN_SLOT_PROB:
            have = covered.get(r["site"], 0)
            if have < 1:
                slots.append((r, 1, r["score"]))
            if r["score"] > 150 and have < 2:
                slots.append((r, 2, r["score"] * 0.45))
    if not crews:
        return []
    value = np.zeros((len(crews), len(slots) + len(crews)))  # extra columns = stay on standby (value 0)
    for i, c in enumerate(crews):
        for j, (r, _, v) in enumerate(slots):
            value[i, j] = v - TRAVEL_WEIGHT * travel_minutes(c["at"], r["site"], speed)
    rows, cols = linear_sum_assignment(-value)
    moves = []
    for i, j in zip(rows, cols):
        c = crews[i]
        if j >= len(slots) or value[i, j] <= 0:
            moves.append({"crew": c["name"], "from": c["at"], "to": c["at"], "standby": True})
            continue
        r, k, v = slots[j]
        moves.append({"crew": c["name"], "from": c["at"], "to": r["site"], "standby": False, "value": round(v, 1),
                      "minutes": round(travel_minutes(c["at"], r["site"], speed)), "p": round(r["p"], 3), "second_crew": k == 2})
    return moves


def approvals(moves, risks, confidence_auto=CONFIDENCE_AUTO):
    """Knowledge-base rules: which moves can run automatically and which need the officer."""
    risk = {r["site"]: r for r in risks}
    active = [m for m in moves if not m["standby"]]
    for m in moves:
        if m["standby"] or m["from"] == m["to"]:
            m["status"], m["why"] = "none", []
            continue
        why, high = [], False
        src = risk.get(m["from"])
        if src and SITE[m["from"]]["protected"] and src["p"] > 0.3 and not any(o is not m and o["to"] == m["from"] for o in active):
            high = True
            why.append(f"leaves {SITE[m['from']]['name']} uncovered ({src['p']:.0%} flood risk)")
        conf = max(m["p"], 1 - m["p"])
        if conf < confidence_auto:
            high = True
            why.append(f"forecast confidence {conf:.0%} below {confidence_auto:.0%}")
        same = sum(1 for o in active if o["to"] == m["to"])
        if len(active) >= 3 and same / len(active) > 0.5:
            high = True
            why.append("more than half of deployed crews in one area")
        m["status"] = "needs_approval" if high else "auto"
        m["why"] = why or ["low risk: nothing left uncovered and forecast is confident"]
    return moves
