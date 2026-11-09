"""Snow & ice module: road-temperature forecast, gritting plan and evaluation.

    python -m floodcrew.ice --gritters 2                 # simulated winters (works offline)

Real data: replace `simulate()` with hourly weather (Open-Meteo: temperature_2m, dew_point_2m, cloud_cover,
precipitation) and, if the council shares it, road sensor temperatures per route.
"""
import argparse

import numpy as np
from scipy.optimize import linear_sum_assignment
from scipy.stats import norm
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROUTES = [  # offset = how much colder/warmer the road runs than the air; impact = priority weight
    {"id": "hosp", "name": "Hospital route", "offset": -0.3, "impact": 140, "protected": True, "x": 760, "y": 470},
    {"id": "bus", "name": "Stockton bus route", "offset": 0.6, "impact": 90, "protected": False, "x": 440, "y": 300},
    {"id": "school", "name": "Yarm school road", "offset": -0.5, "impact": 110, "protected": True, "x": 250, "y": 560},
    {"id": "hill", "name": "Ingleby Barwick hill", "offset": -1.1, "impact": 80, "protected": False, "x": 430, "y": 560},
]
DEPOT = {"x": 775, "y": 350}
HZ, RUN_H, SALT_H = 6, 2, 10   # forecast horizon, hours per gritting run, hours salt stays effective


def simulate(seed=11, days=151, winters=2):
    rng = np.random.default_rng(seed)
    H = winters * days * 24
    air, cloud, precip, dew = (np.zeros(H) for _ in range(4))
    anom, cl, ev = 0.0, 0.6, 0
    for i in range(H):
        d, h = (i // 24) % days, i % 24
        if h == 0:
            anom = 0.8 * anom + 1.6 * rng.standard_normal()
        cl = min(1, max(0, cl + 0.12 * rng.standard_normal() - 0.02 * (cl - 0.6)))
        mean, amp = 5.5 - 4.5 * np.sin(np.pi * d / days), 1.5 + 3 * (1 - cl)
        air[i] = mean + anom + amp * np.sin(2 * np.pi * (h - 9) / 24) + 0.3 * rng.standard_normal()
        cloud[i] = cl
        if ev <= 0 and rng.random() < 0.015 + 0.03 * cl:
            ev = 2 + rng.integers(0, 8)
        precip[i] = 0.3 + 1.5 * rng.random() * cl if ev > 0 else 0
        ev -= 1
        dew[i] = air[i] - (0.5 + 3.5 * (1 - cl)) + 0.3 * rng.standard_normal()
    road = {}
    for rt in ROUTES:
        v, R = air[0], np.zeros(H)
        for i in range(H):
            hh = i % 24
            night, day = hh >= 17 or hh <= 8, 10 <= hh <= 15
            target = air[i] + rt["offset"] + (-2.2 * (1 - cloud[i]) if night else 0) + (2.2 * (1 - cloud[i]) if day else 0)
            v = v + 0.35 * (target - v) + 0.15 * rng.standard_normal()
            R[i] = v
        road[rt["id"]] = R
    return {"H": H, "air": air, "cloud": cloud, "precip": precip, "dew": dew, "road": road,
            "air_err": rng.standard_normal(H) * 1.0, "cloud_err": rng.standard_normal(H) * 0.15}


def icy(W, rid, t):
    wet = W["precip"][max(0, t - 3):t + 1].sum() > 0.1
    return W["road"][rid][t] <= 0 and (wet or W["dew"][t] >= W["road"][rid][t])


def features(W, rid, t):
    R, j, h = W["road"][rid], min(W["H"] - 1, t + HZ), (t + HZ) % 24
    return [R[t], R[t] - R[max(0, t - 3)], W["air"][t], W["air"][j] + W["air_err"][t], W["cloud"][t],
            float(np.clip(W["cloud"][j] + W["cloud_err"][t], 0, 1)), W["dew"][t] - R[t],
            1.0 if (h >= 17 or h <= 8) else 0.0, np.cos(2 * np.pi * h / 24), W["precip"][max(0, t - 5):t + 1].sum()]


def ice_prob(x, pred, sigma):
    cold = norm.cdf((0.3 - pred) / sigma)
    wet = min(1, 0.35 + (0.5 if x[9] > 0.1 else 0) + (0.3 if x[6] > -1 else 0) + 0.3 * x[5])
    return cold * wet


def train(W):
    split = int(W["H"] * 0.75)
    X, y = [], []
    for rt in ROUTES:
        for t in range(6, split - HZ):
            X.append(features(W, rt["id"], t)); y.append(W["road"][rt["id"]][t + HZ])
    model = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(X, y)
    sigma = float(np.std(np.array(y) - model.predict(X)))
    truth, pred, pers, act, ml, rule = [], [], [], [], [], []
    for rt in ROUTES:
        rows = [features(W, rt["id"], t) for t in range(split, W["H"] - HZ)]
        p = model.predict(rows)
        for k, t in enumerate(range(split, W["H"] - HZ)):
            truth.append(W["road"][rt["id"]][t + HZ]); pred.append(p[k]); pers.append(W["road"][rt["id"]][t])
            act.append(icy(W, rt["id"], t + HZ)); ml.append(ice_prob(rows[k], p[k], sigma) >= 0.5); rule.append(rows[k][3] <= 1)
    act, ml, rule = map(np.array, (act, ml, rule))
    pr = lambda a: (a & act).sum() / max(1, a.sum())
    rc = lambda a: (a & act).sum() / max(1, act.sum())
    metrics = {"mae": mean_absolute_error(truth, pred), "mae_persistence": mean_absolute_error(truth, pers),
               "precision": pr(ml), "recall": rc(ml), "precision_air_rule": pr(rule), "recall_air_rule": rc(rule)}
    return model, sigma, split, metrics


def dist_min(rt):
    return np.hypot(rt["x"] - DEPOT["x"], rt["y"] - DEPOT["y"]) * 0.03 / 30 * 60


def replay(W, model, sigma, split, policy, n_gritters):
    treated = {rt["id"]: -99 for rt in ROUTES}
    busy = [0] * n_gritters
    runs = ev_all = ev_ok = prot_all = prot_ok = 0
    dry = {rt["id"]: 99 for rt in ROUTES}

    def active(rid, t):
        return t - treated[rid] <= SALT_H and W["precip"][max(0, treated[rid]):t + 1].sum() <= 6

    for t in range(split, W["H"] - HZ):
        free = [i for i in range(n_gritters) if busy[i] <= t]
        if policy == "floodcrew":
            risks = []
            for rt in ROUTES:
                x = features(W, rt["id"], t)
                p = ice_prob(x, model.predict([x])[0], sigma)
                if p > 0.3 and not (active(rt["id"], t) and t - treated[rt["id"]] < SALT_H - 4):
                    risks.append((rt, p * rt["impact"]))
            if free and risks:
                value = np.array([[s - 0.4 * dist_min(rt) for rt, s in risks] for _ in free])
                rows, cols = linear_sum_assignment(-value)
                for i, j in zip(rows, cols):
                    if value[i, j] > 0:
                        busy[free[i]] = t + RUN_H; treated[risks[j][0]["id"]] = t + RUN_H; runs += 1
        elif t % 24 in (18, 4):   # current practice: precautionary runs when forecast air temperature is 1 C or below
            if (W["air"][t + 1:t + 15] + W["air_err"][t]).min() <= 1:
                for k, rid in enumerate(["hosp", "bus", "school", "hill"]):
                    g = k % n_gritters
                    start = max(t, busy[g]); busy[g] = start + RUN_H; treated[rid] = start + RUN_H; runs += 1
        for rt in ROUTES:
            rid = rt["id"]
            if icy(W, rid, t):
                if dry[rid] >= 6:   # a new ice event starts
                    ok = active(rid, t) and treated[rid] <= t
                    ev_all += 1; ev_ok += ok
                    if rt["protected"]:
                        prot_all += 1; prot_ok += ok
                dry[rid] = 0
            else:
                dry[rid] += 1
    return {"events": ev_all, "treated_in_time": ev_ok, "protected_events": prot_all, "protected_in_time": prot_ok, "runs": runs}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--gritters", type=int, default=2)
    a = p.parse_args()
    W = simulate()
    model, sigma, split, m = train(W)
    print(f"Road temperature 6 h ahead: MAE {m['mae']:.2f} C (persistence {m['mae_persistence']:.2f} C)")
    print(f"Ice warnings: model precision {m['precision']:.0%}, recall {m['recall']:.0%} | "
          f"air-temp rule precision {m['precision_air_rule']:.0%}, recall {m['recall_air_rule']:.0%}")
    for pol in ("floodcrew", "current_practice"):
        r = replay(W, model, sigma, split, pol, a.gritters)
        print(f"{pol:>17}: ice events gritted in time {r['treated_in_time']}/{r['events']} ({r['treated_in_time'] / max(1, r['events']):.0%}), "
              f"hospital + school {r['protected_in_time']}/{r['protected_events']}, gritting runs {r['runs']}")
