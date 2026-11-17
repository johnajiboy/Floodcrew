"""Figures from the real data, saved to docs/figures/.

    python -m floodcrew.figures            # after train (uses models/*.joblib)

  yarm_storm.png   the largest test-period storm at Yarm: actual level, boosting 6-hour forecast, EA warning level,
                   and the hour FloodCrew and current practice first sent a crew (3 crews, protected weight 2.0)
  importance.png   permutation importance of the Yarm boosting model on the test period (increase in MAE)
  ice_night.png    the night in the ice test period where FloodCrew gritted a protected route in time and the fixed
                   schedule did not (2 gritters): estimated road temperature, the 6-hour forecast, the 0 C ice threshold,
                   and when each policy first had salt down on that route
"""
import argparse
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.inspection import permutation_importance

from .config import GAUGES, HORIZON_H, TRAIN_FRACTION
from .evaluate import find_storms, planner_forecasts, replay
from .features import build
from . import ice
from .train import DEFAULT_DATA, OUT, ROOT, load, warning_levels

FIGS = ROOT / "docs" / "figures"
INK, MUTED, GRID = "#0b0b0b", "#52514e", "#e4e3df"
ACTUAL, FORECAST, FLOODCREW, PRACTICE = "#2a78d6", "#eb6834", "#1baf7a", "#6250d6"
LABELS = {"level_now": "Level now", "rise_3h": "Rise over 3 h", "rise_6h": "Rise over 6 h",
          "upstream_level": "Upstream level (Low Moor)", "upstream_rise_3h": "Upstream rise over 3 h",
          "rain_6h": "Rain, last 6 h", "rain_24h": "Rain, last 24 h", "rain_fc_6h": "Rain forecast, next 6 h",
          "soil_wetness": "Soil wetness", "rain_x_wet": "Rain forecast x soil wetness"}


def style(ax):
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(MUTED)
    ax.tick_params(colors=MUTED, labelcolor=INK, labelsize=9)
    ax.xaxis.label.set_color(INK)
    ax.yaxis.label.set_color(INK)


def storm_figure(df, warn, models, preds, split, n_crews=3, protected_weight=2.0):
    storms = find_storms(df, split, warn)
    start, peak, level = max(storms, key=lambda s: s[2])
    first = {p: replay(df, preds, models, warn, start, p, n_crews, protected_weight)[2] for p in ("floodcrew", "current_practice")}
    win = df.index[start:start + 72]
    fc = preds["yarm"].copy()
    fc.index = fc.index + pd.Timedelta(hours=HORIZON_H)   # plot each forecast at the hour it is for
    fc = fc.reindex(win)

    fig, ax = plt.subplots(figsize=(8, 4.2), dpi=150)
    ax.plot(win, df["yarm"].iloc[start:start + 72], color=ACTUAL, lw=2, label="Actual level")
    ax.plot(win, fc, color=FORECAST, lw=2, ls=(0, (4, 2)), label=f"Boosting forecast (made {HORIZON_H} h earlier)")
    ax.axhline(warn["yarm"], color=MUTED, lw=1.2, ls=(0, (1, 2)), label=f"EA warning level ({warn['yarm']:.2f} m)")
    for p, colour, name in [("floodcrew", FLOODCREW, "FloodCrew"), ("current_practice", PRACTICE, "Current practice")]:
        if first[p] is not None:
            ax.axvline(df.index[first[p]], color=colour, lw=1.5,
                       label=f"{name} first dispatch ({df.index[first[p]]:%d %b %H:%M})")
    ax.set_xlabel("Time (UTC)")
    ax.set_ylabel("River level at Yarm (m)")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b\n%H:%M"))
    ax.grid(axis="y", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    style(ax)
    ax.legend(frameon=False, fontsize=8.5, labelcolor=INK, loc="upper left")
    fig.tight_layout()
    fig.savefig(FIGS / "yarm_storm.png")
    plt.close(fig)
    lead = (first["current_practice"] - first["floodcrew"]) if None not in first.values() else None
    print(f"yarm_storm.png: storm peaking {df.index[peak]:%Y-%m-%d %H:%M} at {level:.2f} m; first dispatch FloodCrew "
          f"{df.index[first['floodcrew']] if first['floodcrew'] is not None else 'none'}, current practice "
          f"{df.index[first['current_practice']] if first['current_practice'] is not None else 'none'}"
          + (f" ({lead} h earlier)" if lead is not None else ""))


def importance_figure(df, models, split, repeats=10):
    X, y = build(df, "yarm")
    te = X.index >= split
    r = permutation_importance(models["yarm"]["gbm"], X[te], y[te], scoring="neg_mean_absolute_error",
                               n_repeats=repeats, random_state=0)
    imp = pd.DataFrame({"mean": r.importances_mean * 100, "std": r.importances_std * 100},
                       index=[LABELS.get(c, c) for c in X.columns]).sort_values("mean")
    fig, ax = plt.subplots(figsize=(7, 4.2), dpi=150)
    ax.barh(imp.index, imp["mean"], xerr=imp["std"], color=ACTUAL, height=0.6,
            error_kw={"ecolor": MUTED, "elinewidth": 1, "capsize": 2})
    ax.set_xlabel("Increase in forecast error when shuffled (MAE, cm)")
    ax.set_ylabel("Feature")
    ax.grid(axis="x", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    style(ax)
    fig.tight_layout()
    fig.savefig(FIGS / "importance.png")
    plt.close(fig)
    print("importance.png (MAE increase, cm):\n" + imp["mean"][::-1].round(2).to_string())


def ice_figure(n_gritters=2, threshold=0.0):
    W = ice.real()
    model, sigma, split, _ = ice.train(W)
    times = pd.to_datetime(pd.read_csv(ice.WEATHER_CSV)["time"])
    logs = {p: [] for p in ("floodcrew", "current_practice")}
    for p in logs:
        ice.replay(W, model, sigma, split, p, n_gritters, logs[p])
    ev = {p: {(e[1], e[2]): e[3] for e in logs[p] if e[0] == "event"} for p in logs}
    prot = {rt["id"] for rt in ice.ROUTES if rt["protected"]}
    # events FloodCrew gritted in time and the fixed schedule did not; protected routes first, then latest
    cands = sorted([k for k, ok in ev["floodcrew"].items() if ok and not ev["current_practice"].get(k)],
                   key=lambda k: (k[0] in prot, k[1]))
    rid, t_ev = cands[-1]
    name = next(rt["name"] for rt in ice.ROUTES if rt["id"] == rid)
    a, b = t_ev - 14, t_ev + 12
    fc = {}
    for t in range(a - ice.HZ, b - ice.HZ):
        fc[t + ice.HZ] = model.predict([ice.features(W, rid, t)])[0]   # plotted at the hour it is for
    hours = list(range(a, b))
    first = {p: next((e[3] for e in logs[p] if e[0] == "grit" and e[1] == rid and a <= e[3] <= t_ev + 6), None) for p in logs}

    fig, ax = plt.subplots(figsize=(8, 5), dpi=150)
    ax.plot(times[hours], W["road"][rid][a:b], color=ACTUAL, lw=2, label=f"Estimated road temperature ({name})")
    ax.plot(times[hours], [fc[t] for t in hours], color=FORECAST, lw=2, ls=(0, (4, 2)),
            label=f"Road temperature forecast (made {ice.HZ} h earlier)")
    ax.axhline(threshold, color=MUTED, lw=1.2, ls=(0, (1, 2)), label="Ice threshold (0 \u00b0C, wet road)")
    for p, colour, label in [("floodcrew", FLOODCREW, "FloodCrew"), ("current_practice", PRACTICE, "Fixed schedule")]:
        if first[p] is not None:
            ax.axvline(times[first[p]], color=colour, lw=1.5, label=f"{label} first gritted ({times[first[p]]:%H:%M}, salt down)")
    ax.set_xlabel("Time (GMT)")
    ax.set_ylabel("Road surface temperature (\u00b0C)")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b\n%H:%M"))
    ax.grid(axis="y", color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    style(ax)
    ax.legend(frameon=False, fontsize=8.5, labelcolor=INK, loc="upper center", bbox_to_anchor=(0.5, -0.2), ncol=2)
    fig.tight_layout()
    fig.savefig(FIGS / "ice_night.png")
    plt.close(fig)
    print(f"ice_night.png: {name}, ice from {times[t_ev]:%Y-%m-%d %H:%M}; salt down FloodCrew "
          f"{times[first['floodcrew']] if first['floodcrew'] is not None else 'none'}, fixed schedule "
          f"{times[first['current_practice']] if first['current_practice'] is not None else 'none'}; "
          f"{len(cands)} events where only FloodCrew was in time")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=DEFAULT_DATA)
    a = p.parse_args()
    FIGS.mkdir(parents=True, exist_ok=True)
    df = load(a.data)
    split = df.index[int(len(df) * TRAIN_FRACTION)]
    warn = warning_levels(df)
    models = {g["id"]: joblib.load(OUT / f"{g['id']}.joblib") for g in GAUGES}
    storm_figure(df, warn, models, planner_forecasts(df, models), split)
    importance_figure(df, models, split)
    ice_figure()
