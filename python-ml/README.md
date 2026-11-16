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
python -m floodcrew.fetch_ea                 # download EA river levels + rainfall (2015-01-01 to today)
python -m floodcrew.train                    # train and test the 6-hour forecasts
python -m floodcrew.evaluate --crews 3       # replay every test-period storm: FloodCrew vs current practice
python -m floodcrew.ice --gritters 2         # snow & ice on real Middlesbrough weather
uvicorn api:app --reload                     # then open http://127.0.0.1:8000/docs
```

All results go to `models/metrics.json` (`gauges` from train, `evaluation` from evaluate, `ice` from ice).
The download takes a few minutes the first time; 15-minute readings are cached in `data/raw/` (not committed), so
re-runs are quick. Other ranges: `python -m floodcrew.fetch_ea download --start 2020-01-01 --end 2026-11-16`.
`python -m floodcrew.fetch_ea discover` lists the Tees gauges and nearby rain gauges.

To run offline on simulated data instead: `--data synthetic` for train/evaluate and `--weather synthetic` for ice.

## 3. Real data sources

| Data | Source | Detail |
|---|---|---|
| River levels | Environment Agency **Hydrology API** (`environment.data.gov.uk/hydrology`) | Quality-checked 15-minute level, hourly mean. Broken Scar `F3501`, Low Moor `F3606`, Yarm `L3602`, Stockton `L3907`. Readings flagged Suspect/Missing/Rejected are dropped. |
| Newest readings | Environment Agency **real-time flood-monitoring API** (`environment.data.gov.uk/flood-monitoring`) | Only keeps about the last 28 days, so it tops up readings the Hydrology service has not published yet. |
| Rainfall | EA Hydrology API, 15-minute rain gauges | Up to 6 nearest gauges within 25 km of Yarm with at least 60% hourly coverage, averaged each hour (currently Darlington Lingfield Way, East Cowton, Harpington Hill Farm, Low Moor Farm, Middlesbrough Stewart Park, Romanby). |
| Winter weather | **Open-Meteo historical weather API** (`archive-api.open-meteo.com`, free, no key) | Hourly air temperature, dew point, precipitation and cloud cover for Middlesbrough, winters 2024/25 and 2025/26 (1 Nov to 31 Mar), cached in `data/middlesbrough_weather.csv`. |

Files: `data/tees_hourly.csv` (columns: time, broken, lowmoor, yarm, stockton, rain; levels in metres, rain in mm)
and `data/middlesbrough_weather.csv`.

Notes:
- **Warning levels are the official EA flood alert levels** ("top of normal range: low-lying land flooding possible, one or more flood alerts may be issued"), from the flood-monitoring API (`typicalRangeHigh`) and gov.uk Check for Flooding: Broken Scar 2.50 m, Low Moor 4.50 m, Yarm 1.80 m, Stockton 3.20 m. They are set as `ea_alert` in `config.py`. The EA's "property flooding possible" levels (3.10, 6.50, 5.37 and 3.70 m) are kept as `ea_property` for reference; in 2015–2026 only Broken Scar passed its level (8 hours, Dec 2015 and Feb 2020), too rare to train or test warnings on. Simulated data keeps its own levels (the level exceeded 0.7% of the time).
- Stockton sits above the Tees Barrage, which holds the river level steady, so it barely responds to rain (about 6.5 cm standard deviation). Its forecasts and warnings are weak for that reason, not because of missing data.
- `rain_fc_6h` uses the rain that actually fell, with about ±40% random error to mimic a forecast. In live use, replace it with a real rainfall forecast (for example Open-Meteo).
- **Road temperature is estimated**, not measured: it follows the real air temperature with a lag, plus each route's offset and the effect of clear skies at night and in daytime sun (`estimate_road` in `ice.py`). The 6-hour air temperature and cloud forecasts are the observed values plus noise. If the council can share road sensor temperatures, use them as the target instead.

Attribution: this uses Environment Agency flood and river level data from the real-time data API (Beta) and the
Hydrology data service, Open Government Licence. Weather data by Open-Meteo.com (CC BY 4.0).

## 4. Results on real data (11.9 years, 2015-01-02 to 2026-11-16; test period 28 Nov 2023 to 16 Nov 2026)

| Gauge | EA alert level | Hours above it (test) | MAE ridge | MAE boosting | MAE persistence | Warning recall ridge | Warning recall boosting | Warning recall persistence |
|---|---|---|---|---|---|---|---|---|
| Broken Scar | 2.50 m | 15 | 3.74 cm | 3.24 cm | 3.90 cm | 0% | 0% | 0% |
| Low Moor | 4.50 m | 68 | 7.25 cm | 2.43 cm | 8.21 cm | 49% | 85% | 46% |
| Yarm | 1.80 m | 222 | 3.67 cm | 3.12 cm | 4.41 cm | 68% | 62% | 56% |
| Stockton | 3.20 m | 10 | 2.04 cm | 1.78 cm | 2.18 cm | 0% | 0% | 0% |

Broken Scar and Stockton only reach their alert levels briefly (15 and 10 hours in three years) and no model
caught those hours.

Crew replay (all 18 test-period storms: 7 in 2023/24, 6 in 2024/25, 5 in 2025/26; 3 crews): FloodCrew covered
protected sites 15/17 in time (current practice 0/17) and flooded sites overall 25/46 (current practice 20/46).
Use `--max-storms N` to replay only the first N storms.
Snow & ice (2 gritters, last 25% of winter 2025/26): ice events gritted in time 9/17 = 53% (current practice 6/17 = 35%),
with 36 gritting runs instead of 52.

## 5. What to report

- **Forecast accuracy:** MAE, R², and warning precision/recall for ridge, gradient boosting and persistence (`models/metrics.json`).
- **Decision quality:** sites and protected sites covered in time, FloodCrew vs current practice, for 2, 3 and 5 crews.
- **Trade-offs:** with few crews, FloodCrew puts protected sites first (care home, school, hospital route), so it may cover fewer sites in total. That comes from the protected-site weight, and you can change it.
- **Simon's model:** Intelligence (forecast, risk), Design (optimiser, what-if), Choice (officer approval), Review (evaluation).
