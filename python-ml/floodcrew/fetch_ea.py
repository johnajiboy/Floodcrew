"""Download real Environment Agency data for the Tees.

Usage:
    python -m floodcrew.fetch_ea discover            # list Tees level stations and nearby rain gauges
    python -m floodcrew.fetch_ea download --start 2023-10-01 --end 2025-10-01

Data: Environment Agency real-time flood-monitoring API (Open Government Licence).
"This uses Environment Agency flood and river level data from the real-time data API (Beta)".
"""
import argparse
import sys
import time
from pathlib import Path

import pandas as pd
import requests

from .config import GAUGES, RAIN_SEARCH

ROOT = "https://environment.data.gov.uk/flood-monitoring"
DATA = Path(__file__).resolve().parent.parent / "data"
S = requests.Session()
S.headers["User-Agent"] = "floodcrew-student-project"


def get(url, **params):
    for attempt in range(4):
        r = S.get(url, params=params, timeout=60)
        if r.status_code == 200:
            return r.json()
        time.sleep(2 * (attempt + 1))
    r.raise_for_status()


def discover():
    print("River level stations on the River Tees:\n")
    for st in get(f"{ROOT}/id/stations", riverName="River Tees", parameter="level", _limit=200)["items"]:
        print(f"  {st.get('stationReference',''):>10}  {st.get('label','')}  ({st.get('town','')})")
    print("\nRain gauges near the catchment:\n")
    for st in get(f"{ROOT}/id/stations", parameter="rainfall", lat=RAIN_SEARCH["lat"], long=RAIN_SEARCH["long"],
                  dist=RAIN_SEARCH["dist_km"], _limit=200)["items"]:
        print(f"  {st.get('stationReference',''):>10}  {st.get('label','')}")
    print("\nCopy the level station references for Broken Scar, Low Moor, Yarm and Stockton into "
          "floodcrew/config.py (ea_station). Rain gauges are picked up automatically.")


def readings(station_ref, start, end, parameter):
    """Fetch readings month by month (the API caps each request at 10,000 readings)."""
    frames = []
    months = pd.date_range(start, end, freq="MS").tolist()
    if not months or months[0] > pd.Timestamp(start):
        months = [pd.Timestamp(start)] + months
    months.append(pd.Timestamp(end))
    for a, b in zip(months[:-1], months[1:]):
        js = get(f"{ROOT}/id/stations/{station_ref}/readings", startdate=a.strftime("%Y-%m-%d"),
                 enddate=b.strftime("%Y-%m-%d"), parameter=parameter, _sorted="", _limit=10000)
        items = js.get("items", [])
        if items:
            df = pd.DataFrame(items)[["dateTime", "value"]]
            df["dateTime"] = pd.to_datetime(df["dateTime"], utc=True)
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
            frames.append(df)
        print(f"    {station_ref} {a:%Y-%m}: {len(items)} readings")
    if not frames:
        return pd.Series(dtype=float)
    s = pd.concat(frames).drop_duplicates("dateTime").set_index("dateTime")["value"].sort_index()
    return s


def download(start, end):
    DATA.mkdir(exist_ok=True)
    missing = [g["name"] for g in GAUGES if not g["ea_station"]]
    if missing:
        sys.exit(f"Add EA station references to config.py first for: {', '.join(missing)} (run 'discover').")
    out = {}
    for g in GAUGES:
        print(f"Level: {g['name']} ({g['ea_station']})")
        s = readings(g["ea_station"], start, end, "level")
        out[g["id"]] = s.resample("1h").mean().interpolate(limit=6)
    rain_st = get(f"{ROOT}/id/stations", parameter="rainfall", lat=RAIN_SEARCH["lat"], long=RAIN_SEARCH["long"],
                  dist=RAIN_SEARCH["dist_km"], _limit=50)["items"]
    rains = []
    for st in rain_st[:6]:
        ref = st.get("stationReference")
        print(f"Rain: {st.get('label','')} ({ref})")
        s = readings(ref, start, end, "rainfall")
        if len(s):
            rains.append(s.resample("1h").sum(min_count=1))
    if not rains:
        sys.exit("No rainfall data returned. Check RAIN_SEARCH in config.py.")
    df = pd.DataFrame(out)
    df["rain"] = pd.concat(rains, axis=1).mean(axis=1)
    df = df.dropna(how="all")
    df["rain"] = df["rain"].fillna(0)
    path = DATA / "tees_hourly.csv"
    df.to_csv(path)
    print(f"\nSaved {len(df):,} hourly rows to {path}")
    print("Coverage per column:\n" + (df.notna().mean() * 100).round(1).astype(str).add(" %").to_string())
    print("\nIf older months returned 0 readings, the real-time API no longer holds them. "
          "Use a shorter, recent date range, or download quality-checked history from the EA Hydrology service "
          "(environment.data.gov.uk/hydrology) and save it in the same CSV format.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("discover")
    d = sub.add_parser("download")
    d.add_argument("--start", required=True)
    d.add_argument("--end", required=True)
    a = p.parse_args()
    discover() if a.cmd == "discover" else download(a.start, a.end)
