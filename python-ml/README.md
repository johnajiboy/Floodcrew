# FloodCrew: intelligent decision support for flood crew deployment

FloodCrew helps an emergency officer decide where to send a limited number of crews when the River Tees is rising.

| IDSS part | File | What it does |
|---|---|---|
| Data | `floodcrew/fetch_ea.py`, `floodcrew/synthetic.py` | Real Environment Agency river levels and rainfall (default), or a simulated Tees catchment |
| Model (ML) | `floodcrew/train.py` | Forecasts each gauge 6 hours ahead (ridge regression + gradient boosting), tested against persistence |
| Knowledge base (rules) | `floodcrew/plan.py` | Flood probability per site, impact (homes, protected sites), approval rules |
| Optimisation | `floodcrew/plan.py` | Hungarian assignment of crews to sites (value protected minus travel time) |
| Evaluation | `floodcrew/evaluate.py` | Replays every test storm: FloodCrew vs current practice |
| Snow & ice | `floodcrew/ice.py` | Real Middlesbrough weather (Open-Meteo), estimated road temperature, ice risk per route, gritter assignment, replay vs precautionary runs |
| Interface | `api.py` | FastAPI endpoints for forecast, plan and metrics |

The model is trained on the first 75% of the data (in time order) and tested on the last 25%, which it never sees during training.

## 1. Set up

```bash
cd python-ml
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Run on real data

```bash
python -m floodcrew.fetch_ea                 # download EA river levels + rainfall (2023-01-01 to today)
python -m floodcrew.train                    # train and test the 6-hour forecasts
python -m floodcrew.evaluate --crews 3       # replay real test-period storms: FloodCrew vs current practice
python -m floodcrew.ice --gritters 2         # snow & ice on real Middlesbrough weather
uvicorn api:app --reload                     # then open http://127.0.0.1:8000/docs
```

All results go to `models/metrics.json` (`gauges` from train, `evaluation` from evaluate, `ice` from ice).
The download takes a few minutes the first time; 15-minute readings are cached in `data/raw/` (not committed), so
re-runs are quick. Other ranges: `python -m floodcrew.fetch_ea download --start 2022-01-01 --end 2026-11-16`.
`python -m floodcrew.fetch_ea discover` lists the Tees gauges and nearby rain gauges.

To run offline on simulated data instead: `--data synthetic` for train/evaluate and `--weather synthetic` for ice.

## 3. Real data sources

| Data | Source | Detail |
|---|---|---|
| River levels | Environment Agency **Hydrology API** (`environment.data.gov.uk/hydrology`) | Quality-checked 15-minute level, hourly mean. Broken Scar `F3501`, Low Moor `F3606`, Yarm `L3602`, Stockton `L3907`. Readings flagged Suspect/Missing/Rejected are dropped. |
| Newest readings | Environment Agency **real-time flood-monitoring API** (`environment.data.gov.uk/flood-monitoring`) | Only keeps about the last 28 days, so it tops up readings the Hydrology service has not published yet. |
| Rainfall | EA Hydrology API, 15-minute rain gauges | Up to 6 nearest gauges within 25 km of Yarm with at least 60% hourly coverage, averaged each hour (currently Darlington Lingfield Way, East Cowton, Harpington Hill Farm, Low Moor Farm, Romanby, Evenwood Gate). |
| Winter weather | **Open-Meteo historical weather API** (`archive-api.open-meteo.com`, free, no key) | Hourly air temperature, dew point, precipitation and cloud cover for Middlesbrough, winters 2024/25 and 2025/26 (1 Nov to 31 Mar), cached in `data/middlesbrough_weather.csv`. |

Files: `data/tees_hourly.csv` (columns: time, broken, lowmoor, yarm, stockton, rain; levels in metres, rain in mm)
and `data/middlesbrough_weather.csv`.

Notes:
- Warning levels are estimated as the level exceeded 0.7% of the time. If you know the official EA thresholds for each gauge, use those instead.
- Stockton sits above the Tees Barrage, which holds the river level steady, so it barely responds to rain (about 6 cm standard deviation). Its forecasts and warnings are weak for that reason, not because of missing data.
- `rain_fc_6h` uses the rain that actually fell, with about ±40% random error to mimic a forecast. In live use, replace it with a real rainfall forecast (for example Open-Meteo).
- **Road temperature is estimated**, not measured: it follows the real air temperature with a lag, plus each route's offset and the effect of clear skies at night and in daytime sun (`estimate_road` in `ice.py`). The 6-hour air temperature and cloud forecasts are the observed values plus noise. If the council can share road sensor temperatures, use them as the target instead.

Attribution: this uses Environment Agency flood and river level data from the real-time data API (Beta) and the
Hydrology data service, Open Government Licence. Weather data by Open-Meteo.com (CC BY 4.0).

## 4. Results on real data (test period 27 Nov 2025 to 16 Nov 2026)

| Gauge | MAE ridge | MAE boosting | MAE persistence | Warning recall (ridge) | Warning recall (persistence) |
|---|---|---|---|---|---|
| Broken Scar | 3.46 cm | 3.33 cm | 3.55 cm | 35% | 47% |
| Low Moor | 6.40 cm | 2.15 cm | 7.34 cm | 42% | 45% |
| Yarm | 3.63 cm | 2.97 cm | 3.84 cm | 69% | 54% |
| Stockton | 2.14 cm | 1.95 cm | 1.94 cm | 16% | 0% |

Crew replay (4 test-period storms, 3 crews): FloodCrew covered protected sites 3/4 in time (current practice 1/4)
and flooded sites overall 4/11 (current practice 7/11).
Snow & ice (2 gritters, last 25% of winter 2025/26): ice events gritted in time 9/17 = 53% (current practice 6/17 = 35%),
with 36 gritting runs instead of 52.

## 5. What to report

- **Forecast accuracy:** MAE, R², and warning precision/recall for ridge, gradient boosting and persistence (`models/metrics.json`).
- **Decision quality:** sites and protected sites covered in time, FloodCrew vs current practice, for 2, 3 and 5 crews.
- **Trade-offs:** with few crews, FloodCrew puts protected sites first (care home, school, hospital route), so it may cover fewer sites in total. That comes from the protected-site weight, and you can change it.
- **Simon's model:** Intelligence (forecast, risk), Design (optimiser, what-if), Choice (officer approval), Review (evaluation).
