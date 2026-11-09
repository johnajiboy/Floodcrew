"""Replay every storm in the test period and compare FloodCrew with current practice.

    python -m floodcrew.evaluate --data synthetic --crews 3

Current practice = wait for the official warning (gauge reaches its warning level), then send the nearest crew
to that river's sites, most homes first. A site counts as protected if a crew is on site at the moment it floods.
"""
import argparse
from math import ceil

import joblib
import numpy as np
import pandas as pd

from .config import CREWS, GAUGES, HORIZON_H, SITES, TRAIN_FRACTION
from .features import build
from .plan import plan, site_risk, travel_minutes
from .train import OUT, load, warning_levels


def find_storms(df, split, warn, n=6):
    L = df["yarm"].to_numpy()
    i0 = df.index.get_indexer([split], method="nearest")[0] + 48
    storms, t = [], i0
    while t < len(L) - 48 and len(storms) < n:
        if L[t] >= warn["yarm"] - 0.1 > L[t - 1]:
            peak = t + int(np.argmax(L[t:t + 48]))
            storms.append((t - 18, peak, L[peak]))
            t += 96
        else:
            t += 1
    return storms


def run(data, n_crews, protected_weight):
    df = load(data)
    split = df.index[int(len(df) * TRAIN_FRACTION)]
    warn = warning_levels(df)
    models = {g["id"]: joblib.load(OUT / f"{g['id']}.joblib") for g in GAUGES}
    feats = {g["id"]: build(df, g["id"])[0] for g in GAUGES}
    preds = {gid: pd.Series(models[gid]["ridge"].predict(feats[gid]), index=feats[gid].index) for gid in models}
    totals = {"floodcrew": np.zeros(4), "current_practice": np.zeros(4)}
    for (start, peak, level) in find_storms(df, split, warn):
        for policy in totals:
            crews = [{"id": f"c{i}", "name": CREWS[i], "at": "depot", "busy_until": -1, "dest": None} for i in range(n_crews)]
            protected_at, flooded_at = {}, {}
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
                else:
                    need = [s for s in SITES if df[s["gauge"]].iloc[t] >= warn[s["gauge"]]
                            and not any(c["at"] == s["id"] or c["dest"] == s["id"] for c in crews)]
                    for s in sorted(need, key=lambda s: -(s["homes"] + (60 if s["protected"] else 0))):
                        free = [c for c in crews if not c["dest"]]
                        if not free:
                            break
                        c = min(free, key=lambda c: travel_minutes(c["at"], s["id"]))
                        c["dest"], c["busy_until"] = s["id"], t + max(1, ceil(travel_minutes(c["at"], s["id"]) / 60))
            flooded = [s for s in SITES if s["id"] in flooded_at]
            ok = [s for s in flooded if s["id"] in protected_at]
            totals[policy] += [len(ok), len(flooded), sum(s["protected"] for s in ok), sum(s["protected"] for s in flooded)]
    for k, (ok, fl, pok, pfl) in totals.items():
        print(f"{k:>17}: flooded sites protected in time {int(ok)}/{int(fl)} ({ok / max(fl, 1):.0%}), "
              f"protected sites {int(pok)}/{int(pfl)} ({pok / max(pfl, 1):.0%})")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="synthetic")
    p.add_argument("--crews", type=int, default=3)
    p.add_argument("--protected-weight", type=float, default=2.0)
    a = p.parse_args()
    run(a.data, a.crews, a.protected_weight)
