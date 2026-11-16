"""Download real Environment Agency river levels and rainfall for the Tees.

Usage:
    python -m floodcrew.fetch_ea                                         # 2023-01-01 to today (default)
    python -m floodcrew.fetch_ea download --start 2023-01-01 --end 2026-11-16
    python -m floodcrew.fetch_ea discover                                # list Tees level stations and rain gauges

Sources (both Environment Agency, Open Government Licence):
  * Hydrology API (environment.data.gov.uk/hydrology): quality-checked 15-minute history for the four Tees gauges
    and nearby rain gauges. This is where the multi-year history comes from.
  * Real-time flood-monitoring API (environment.data.gov.uk/flood-monitoring): only keeps about the last 28 days,
    so it is used to top up the newest readings that the Hydrology service has not published yet.

Output:
  data/raw/<gauge or rain gauge>.csv   15-minute readings as downloaded (cache, not committed)
  data/tees_hourly.csv                 hourly table: time, broken, lowmoor, yarm, stockton, rain
                                       (levels = hourly mean in metres, rain = catchment-average hourly total in mm)
"""
import argparse
import math
import sys
import time
from pathlib import Path

import pandas as pd
import requests

from .config import GAUGES, RAIN_SEARCH

REALTIME = "https://environment.data.gov.uk/flood-monitoring"
HYDROLOGY = "https://environment.data.gov.uk/hydrology"
DATA = Path(__file__).resolve().parent.parent / "data"
RAW = DATA / "raw"
N_RAIN = 6                  # rain gauges averaged into one catchment series
MIN_RAIN_COVERAGE = 0.6     # skip rain gauges with hourly data for less than 60% of the period
BAD_QUALITY = {"Suspect", "Missing", "Rejected"}
DEFAULT_START = "2023-01-01"
S = requests.Session()
S.headers["User-Agent"] = "floodcrew-student-project"


def get(url, **params):
    for attempt in range(5):
        try:
            r = S.get(url, params=params, timeout=180)
            if r.status_code == 200:
                return r.json()
        except requests.RequestException:
            pass
        time.sleep(3 * (attempt + 1))
    r = S.get(url, params=params, timeout=180)
    r.raise_for_status()
    return r.json()


def discover():
    print("River level stations on the River Tees:\n")
    for st in get(f"{REALTIME}/id/stations", riverName="River Tees", parameter="level", _limit=200)["items"]:
        print(f"  {st.get('stationReference',''):>10}  {st.get('label','')}  ({st.get('town','')})")
    print("\nRain gauges with 15-minute history near the catchment:\n")
    for st in rain_stations():
        print(f"  {st['ref']:>10}  {st['label']}  ({st['km']:.1f} km)")


# ---------- Hydrology API (history) ----------
def hydro_measure(station_ref, kind):
    """kind 'level' -> 15-min instantaneous level; 'rain' -> 15-min rainfall total."""
    items = get(f"{HYDROLOGY}/id/stations", stationReference=station_ref)["items"]
    if not items:
        return None
    key = "level-i-900" if kind == "level" else "rainfall-t-900"
    for m in items[0].get("measures", []):
        if key in m["@id"]:
            return m["@id"].rsplit("/", 1)[-1]
    return None


def hydro_readings(measure, start, end):
    """Fetch in 6-month chunks (about 17,500 readings each) to keep requests small."""
    frames, a = [], pd.Timestamp(start)
    end = pd.Timestamp(end)
    while a < end:
        b = min(a + pd.DateOffset(months=6), end)
        items = get(f"{HYDROLOGY}/id/measures/{measure}/readings", **{"min-date": a.strftime("%Y-%m-%d"),
                    "max-date": b.strftime("%Y-%m-%d"), "_limit": 50000})["items"]
        if items:
            df = pd.DataFrame(items)
            df = df[~df.get("quality", pd.Series("", index=df.index)).isin(BAD_QUALITY)]
            frames.append(pd.DataFrame({"dateTime": pd.to_datetime(df["dateTime"], utc=True),
                                        "value": pd.to_numeric(df["value"], errors="coerce")}))
        print(f"      {a:%Y-%m-%d} .. {b:%Y-%m-%d}: {len(items):,} readings")
        a = b
    if not frames:
        return pd.Series(dtype=float)
    return pd.concat(frames).dropna().drop_duplicates("dateTime").set_index("dateTime")["value"].sort_index()


# ---------- real-time API (newest readings) ----------
def realtime_readings(station_ref, parameter, since):
    items = get(f"{REALTIME}/id/stations/{station_ref}/readings", since=since.strftime("%Y-%m-%dT%H:%M:%SZ"),
                parameter=parameter, _sorted="", _limit=10000).get("items", [])
    if not items:
        return pd.Series(dtype=float)
    df = pd.DataFrame(items)
    if parameter == "level":   # some stations also report a downstream stage; keep the main stage
        main = df[df["measure"].str.contains("level-stage")]
        df = main if len(main) else df
    s = pd.Series(pd.to_numeric(df["value"], errors="coerce").to_numpy(), index=pd.to_datetime(df["dateTime"], utc=True))
    return s[~s.index.duplicated()].sort_index().dropna()


def series(station_ref, kind, start, end, name):
    """History from Hydrology, topped up with real-time readings after Hydrology's last reading. Cached in data/raw."""
    RAW.mkdir(parents=True, exist_ok=True)
    cache = RAW / f"{name}.csv"
    print(f"  {name} ({station_ref})", flush=True)
    if cache.exists():   # reuse an earlier download when it already covers the range
        c = pd.read_csv(cache, index_col=0, parse_dates=True)["value"]
        lo, hi = pd.Timestamp(start, tz="UTC"), pd.Timestamp(end, tz="UTC")
        if len(c) and c.index.min() <= lo + pd.Timedelta(days=2) and c.index.max() >= hi - pd.Timedelta(days=1):
            print(f"      cached: {len(c):,} readings")
            return c[(c.index >= lo) & (c.index < hi + pd.Timedelta(days=1))]
    measure = hydro_measure(station_ref, kind)
    s = hydro_readings(measure, start, end) if measure else pd.Series(dtype=float)
    last = s.index.max() if len(s) else pd.Timestamp(start, tz="UTC")
    end_ts = pd.Timestamp(end, tz="UTC") + pd.Timedelta(days=1)
    if end_ts - last > pd.Timedelta(hours=1) and pd.Timestamp.now(tz="UTC") - last < pd.Timedelta(days=28):
        rt = realtime_readings(station_ref, "level" if kind == "level" else "rainfall", last)
        rt = rt[(rt.index > last) & (rt.index < end_ts)]
        print(f"      real-time top-up after {last:%Y-%m-%d %H:%M}: {len(rt):,} readings")
        s = pd.concat([s, rt]).sort_index()
    if not len(s):
        return pd.Series(dtype=float, index=pd.DatetimeIndex([], tz="UTC"))
    s = s[(s.index >= pd.Timestamp(start, tz="UTC")) & (s.index < end_ts)]
    s.rename("value").to_csv(cache, index_label="dateTime")
    return s


def rain_stations():
    items = get(f"{HYDROLOGY}/id/stations", observedProperty="rainfall", lat=RAIN_SEARCH["lat"], long=RAIN_SEARCH["long"],
                dist=RAIN_SEARCH["dist_km"], _limit=100)["items"]
    out = []
    for st in items:
        ref = st.get("stationReference")
        if not ref or not any("rainfall-t-900" in m["@id"] for m in st.get("measures", [])):
            continue
        dlat = (float(st["lat"]) - RAIN_SEARCH["lat"]) * 111.2
        dlon = (float(st["long"]) - RAIN_SEARCH["long"]) * 111.2 * math.cos(math.radians(RAIN_SEARCH["lat"]))
        km = math.hypot(dlat, dlon)
        if km <= RAIN_SEARCH["dist_km"]:   # the API does not always apply the radius itself
            out.append({"ref": ref, "label": st.get("label", ref), "km": km})
    return sorted(out, key=lambda r: r["km"])


def download(start, end):
    missing = [g["name"] for g in GAUGES if not g["ea_station"]]
    if missing:
        sys.exit(f"Add EA station references to config.py first for: {', '.join(missing)} (run 'discover').")
    DATA.mkdir(exist_ok=True)
    print(f"Downloading {start} to {end}\nRiver levels (15-minute):")
    out = {}
    for g in GAUGES:
        s = series(g["ea_station"], "level", start, end, g["id"])
        out[g["id"]] = s.resample("1h").mean().interpolate(limit=6, limit_area="inside")
    print(f"Rainfall (15-minute), up to {N_RAIN} nearest gauges within {RAIN_SEARCH['dist_km']} km:")
    rains, hours = [], pd.date_range(start, end, freq="1h", tz="UTC")
    for st in rain_stations():
        s = series(st["ref"], "rain", start, end, f"rain_{st['ref']}")
        h = s.resample("1h").sum(min_count=1).reindex(hours) if len(s) else pd.Series(index=hours, dtype=float)
        cover = h.notna().mean()
        if cover >= MIN_RAIN_COVERAGE:
            rains.append(h.rename(f"{st['label']} ({st['km']:.0f} km, {cover:.0%})"))
        else:
            print(f"      hourly coverage {cover:.0%}, skipped")
        if len(rains) == N_RAIN:
            break
    if not rains:
        sys.exit("No rainfall data returned. Check RAIN_SEARCH in config.py.")
    df = pd.DataFrame(out)
    df["rain"] = pd.concat(rains, axis=1, sort=True).mean(axis=1)   # average of the gauges reporting each hour
    df = df.dropna(how="all", subset=[g["id"] for g in GAUGES])
    df["rain"] = df["rain"].fillna(0).round(3)
    df[[g["id"] for g in GAUGES]] = df[[g["id"] for g in GAUGES]].round(4)
    df.index.name = "time"
    path = DATA / "tees_hourly.csv"
    df.to_csv(path)
    years = (df.index.max() - df.index.min()).days / 365.25
    print(f"\nSaved {len(df):,} hourly rows ({years:.1f} years, {df.index.min():%Y-%m-%d} to {df.index.max():%Y-%m-%d}) to {path}")
    print("Rain gauges used: " + ", ".join(r.name for r in rains))
    print("Coverage per column:\n" + (df.notna().mean() * 100).round(1).astype(str).add(" %").to_string())
    if years < 2:
        sys.exit("Less than 2 years of data: use an earlier --start.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")
    sub.add_parser("discover")
    d = sub.add_parser("download")
    d.add_argument("--start", default=DEFAULT_START)
    d.add_argument("--end", default=pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d"))
    a = p.parse_args()
    if a.cmd == "discover":
        discover()
    else:
        download(getattr(a, "start", DEFAULT_START), getattr(a, "end", pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d")))
