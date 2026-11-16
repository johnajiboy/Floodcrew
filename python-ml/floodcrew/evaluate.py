"""Replay every storm in the test period and compare FloodCrew with current practice.

    python -m floodcrew.evaluate --crews 3                    # real data (default once downloaded)
    python -m floodcrew.evaluate --data synthetic --crews 3

Current practice = wait for the official warning (gauge reaches its warning level), then send the nearest crew
to that river's sites, most homes first. A site counts as protected if a crew is on site at the moment it floods.
"""
import argparse
import json
from math import ceil

import joblib
import numpy as np
import pandas as pd

from .config import CREWS, GAUGES, HORIZON_H, PLANNER_MODEL, SITES, TRAIN_FRACTION
from .features import build
from .plan import plan, site_risk, travel_minutes
from .train import DEFAULT_DATA, OUT, load, update_metrics, warning_levels


def find_storms(df, split, warn, n=None):
    """Every storm in the test period (Yarm rising to within 10 cm of its warning level), or the first n if given."""
    L = df["yarm"].to_numpy()
    i0 = df.index.get_indexer([split], method="nearest")[0] + 48
    storms, t = [], i0
    while t < len(L) - 48 and (n is None or len(storms) < n):
        if L[t] >= warn["yarm"] - 0.1 > L[t - 1]:
            peak = t + int(np.argmax(L[t:t + 48]))
            storms.append((t - 18, peak, L[peak]))
            t += 96
        else:
            t += 1
    return storms


def replay(df, preds, models, warn, start, policy, n_crews, protected_weight):
    """Replay one storm for 72 hours under one policy. Returns (protected_at, flooded_at, first_dispatch) as row indices."""
    crews = [{"id": f"c{i}", "name": CREWS[i], "at": "depot", "busy_until": -1, "dest": None} for i in range(n_crews)]
    protected_at, flooded_at, first_dispatch = {}, {}, None
    for t in range(start, min(start + 72, len(df) - HORIZON_H)):
        ts = df.index[t]
        for c in crews:
            if c["dest"] and t >= c["busy_until"]:
                c["at"], c["dest"] = c["dest"], None
        for s in SITES:
            if s["id"] not in flooded_at and df[s["gauge"]].iloc[t] >= warn[s["gauge"]] + s["offset"]:
                flooded_at[s["id"]] = t
                # protected = a crew is already on site at the moment it floods
                if any(c["at"] == s["id"] and not c["dest"] for c in crews):
                    protected_at[s["id"]] = t
        free = [c for c in crews if not c["dest"]]
        if not free:
            continue
        if policy == "floodcrew":
            fc = {gid: {"pred": float(preds[gid].get(ts, df[gid].iloc[t])), "sigma": models[gid]["sigma"]} for gid in models}
            risks = site_risk(fc, warn, protected_weight)
            p_now = {r["site"]: r["p"] for r in risks}
            # crews standing at a site whose risk has passed (and that has not flooded) can be re-tasked
            free = [c for c in free if c["at"] == "depot" or p_now.get(c["at"], 0) < 0.1 or c["at"] in flooded_at]
            busy = [c for c in crews if c not in free]
            covered = {}
            for c in busy:
                site = c["dest"] or c["at"]
                covered[site] = covered.get(site, 0) + 1
            for m in plan(risks, free, covered=covered):
                if not m["standby"] and m["to"] != m["from"]:
                    c = next(c for c in crews if c["name"] == m["crew"])
                    c["dest"], c["busy_until"] = m["to"], t + max(1, ceil(m["minutes"] / 60))
                    first_dispatch = t if first_dispatch is None else first_dispatch
        else:
            need = [s for s in SITES if df[s["gauge"]].iloc[t] >= warn[s["gauge"]]
                    and not any(c["at"] == s["id"] or c["dest"] == s["id"] for c in crews)]
            for s in sorted(need, key=lambda s: -(s["homes"] + (60 if s["protected"] else 0))):
                free = [c for c in crews if not c["dest"]]
                if not free:
                    break
                c = min(free, key=lambda c: travel_minutes(c["at"], s["id"]))
                c["dest"], c["busy_until"] = s["id"], t + max(1, ceil(travel_minutes(c["at"], s["id"]) / 60))
                first_dispatch = t if first_dispatch is None else first_dispatch
    return protected_at, flooded_at, first_dispatch


def planner_forecasts(df, models):
    """Planner-model forecast of each gauge's level HORIZON_H hours ahead, indexed by the time it was made."""
    feats = {g["id"]: build(df, g["id"])[0] for g in GAUGES}
    return {gid: pd.Series(models[gid][PLANNER_MODEL].predict(feats[gid]), index=feats[gid].index) for gid in models}


def run(data, n_crews, protected_weight, max_storms=None):
    df = load(data)
    split = df.index[int(len(df) * TRAIN_FRACTION)]
    warn = warning_levels(df)
    models = {g["id"]: joblib.load(OUT / f"{g['id']}.joblib") for g in GAUGES}
    preds = planner_forecasts(df, models)
    totals = {"floodcrew": np.zeros(4), "current_practice": np.zeros(4)}
    storms = find_storms(df, split, warn, max_storms)
    for (start, peak, level) in storms:
        for policy in totals:
            protected_at, flooded_at, _ = replay(df, preds, models, warn, start, policy, n_crews, protected_weight)
            flooded = [s for s in SITES if s["id"] in flooded_at]
            ok = [s for s in flooded if s["id"] in protected_at]
            totals[policy] += [len(ok), len(flooded), sum(s["protected"] for s in ok), sum(s["protected"] for s in flooded)]
    result = {"data": data, "crews": n_crews, "protected_weight": protected_weight, "planner_model": PLANNER_MODEL,
              "storms": [{"start": str(df.index[s]), "peak": str(df.index[p]), "yarm_peak_m": round(float(lv), 3)} for s, p, lv in storms]}
    for k, (ok, fl, pok, pfl) in totals.items():
        print(f"{k:>17}: flooded sites protected in time {int(ok)}/{int(fl)} ({ok / max(fl, 1):.0%}), "
              f"protected sites {int(pok)}/{int(pfl)} ({pok / max(pfl, 1):.0%})")
        result[k] = {"sites_protected": int(ok), "sites_flooded": int(fl), "protected_sites_covered": int(pok),
                     "protected_sites_flooded": int(pfl)}
    winters = pd.Series([df.index[p] for _, p, _ in storms]).map(lambda d: f"{d.year - (d.month < 7)}/{str(d.year - (d.month < 7) + 1)[2:]}")
    result["storms_per_winter"] = winters.value_counts().sort_index().to_dict()
    print(f"Storms replayed: {len(storms)} " + str(result["storms_per_winter"]))
    # every run is kept: evaluation_runs[protected weight][crews]
    runs = json.loads((OUT / "metrics.json").read_text()).get("evaluation_runs", {}) if (OUT / "metrics.json").exists() else {}
    runs.setdefault(f"{protected_weight:.1f}", {})[str(n_crews)] = {k: result[k] for k in ("floodcrew", "current_practice")}
    runs = {w: dict(sorted(v.items(), key=lambda kv: int(kv[0]))) for w, v in sorted(runs.items())}
    update_metrics("evaluation_runs", runs)
    if n_crews == 3 and protected_weight == 2.0:   # the headline evaluation: 3 crews, default protected weight
        update_metrics("evaluation", result)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=DEFAULT_DATA)
    p.add_argument("--crews", type=int, default=3)
    p.add_argument("--protected-weight", type=float, default=2.0)
    p.add_argument("--max-storms", type=int, default=None, help="replay only the first N storms (default: all)")
    a = p.parse_args()
    run(a.data, a.crews, a.protected_weight, a.max_storms)
