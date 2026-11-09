"""Turn the hourly table into model features. One model per gauge forecasts its level HORIZON_H hours ahead."""
import numpy as np
import pandas as pd
from .config import GAUGES, HORIZON_H

FEATURES = ["level_now", "rise_3h", "rise_6h", "upstream_level", "upstream_rise_3h",
            "rain_6h", "rain_24h", "rain_fc_6h", "soil_wetness", "rain_x_wet"]


def add_soil_wetness(df: pd.DataFrame) -> pd.DataFrame:
    w, out = 0.0, np.zeros(len(df))
    for i, r in enumerate(df["rain"].to_numpy()):
        w = w * 0.985 + (0 if np.isnan(r) else r)
        out[i] = w
    df = df.copy()
    df["wetness_index"] = out
    return df


def upstream_of(gid: str) -> str:
    ids = [g["id"] for g in GAUGES]
    return ids[max(0, ids.index(gid) - 1)]


def build(df: pd.DataFrame, gid: str, rain_forecast_error: float = 0.4, seed: int = 97, extra_rain: float = 0.0):
    """Returns X (features), y (level HORIZON_H hours later), aligned by time.

    rain_fc_6h uses the rainfall that actually fell in the next 6 hours, multiplied by a random error
    (about +/-40%) to mimic a real rainfall forecast. In live use, replace it with a real forecast (e.g. Open-Meteo)."""
    if "wetness_index" not in df:
        df = add_soil_wetness(df)
    L, U, R = df[gid], df[upstream_of(gid)], df["rain"]
    rng = np.random.default_rng(seed)
    fc_err = np.exp(rain_forecast_error * rng.standard_normal(len(df)) - 0.08)
    rain_next = R[::-1].rolling(HORIZON_H, min_periods=1).sum()[::-1].shift(-1)
    X = pd.DataFrame({
        "level_now": L,
        "rise_3h": L - L.shift(3),
        "rise_6h": L - L.shift(6),
        "upstream_level": U,
        "upstream_rise_3h": U - U.shift(3),
        "rain_6h": R.rolling(6, min_periods=1).sum(),
        "rain_24h": R.rolling(24, min_periods=1).sum(),
        "rain_fc_6h": rain_next * fc_err + extra_rain,
        "soil_wetness": np.minimum(1, df["wetness_index"] / 120),
    }, index=df.index)
    X["rain_x_wet"] = X["rain_fc_6h"] * X["soil_wetness"]
    y = L.shift(-HORIZON_H).rename("target")
    ok = X.notna().all(axis=1) & y.notna()
    return X[ok], y[ok]
