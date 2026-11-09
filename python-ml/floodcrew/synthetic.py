"""Simulated Tees catchment: 2 years of hourly rain, soil wetness and 4 river gauges.
Used when real Environment Agency data is not available (and for testing)."""
import numpy as np
import pandas as pd
from .config import GAUGES


def simulate(seed: int = 7, years: int = 2) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    H = 24 * 365 * years
    rain = np.zeros(H)
    t = 0
    while t < H:
        doy = (t / 24 + 90) % 365
        winter = 0.5 + 0.5 * np.cos(2 * np.pi * (doy - 15) / 365)
        rate = 1 / (24 * (7 - 4 * winter))
        t += max(1, int(round(rng.exponential(1 / rate))))
        dur = 4 + rng.integers(0, 30)
        peak = 0.5 + rng.random() ** 2.2 * (5 + 6 * winter)
        idx = np.arange(dur)
        seg = peak * np.sin(np.pi * (idx + 0.5) / dur) * (0.6 + 0.8 * rng.random(dur))
        if t >= H:
            break
        end = min(H, t + dur)
        rain[t:end] += seg[: end - t]
    wet = np.zeros(H)
    w = 0.0
    for i in range(H):
        w = w * 0.985 + rain[i]
        wet[i] = w
    eff = rain * (0.25 + 0.75 * (1 - np.exp(-wet / 60)))
    idx = pd.date_range("2023-04-01", periods=H, freq="h", tz="UTC")
    df = pd.DataFrame({"rain": rain}, index=idx)
    for g in GAUGES:
        k = np.arange(48) / g["k"]
        uh = k * np.exp(-k)
        uh /= uh.sum()
        acc = np.convolve(eff, uh)[:H]
        acc = np.concatenate([np.zeros(g["lag"]), acc[: H - g["lag"]]])
        doy = (np.arange(H) / 24 + 90) % 365
        season = 0.12 * np.cos(2 * np.pi * (doy - 15) / 365)
        df[g["id"]] = g["base"] + season + g["gain"] * 11 * np.power(acc, 0.8) + 0.02 * rng.standard_normal(H)
    return df
