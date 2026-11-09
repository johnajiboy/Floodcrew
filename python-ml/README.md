# FloodCrew: intelligent decision support for flood crew deployment

FloodCrew helps an emergency officer decide where to send a limited number of crews when the River Tees is rising.

| IDSS part | File | What it does |
|---|---|---|
| Data | `floodcrew/fetch_ea.py`, `floodcrew/synthetic.py` | Real Environment Agency river levels and rainfall, or a simulated Tees catchment |
| Model (ML) | `floodcrew/train.py` | Forecasts each gauge 6 hours ahead (ridge regression + gradient boosting), tested against persistence |
| Knowledge base (rules) | `floodcrew/plan.py` | Flood probability per site, impact (homes, protected sites), approval rules |
| Optimisation | `floodcrew/plan.py` | Hungarian assignment of crews to sites (value protected minus travel time) |
| Evaluation | `floodcrew/evaluate.py` | Replays every test storm: FloodCrew vs current practice |
| Snow & ice | `floodcrew/ice.py` | Road-temperature forecast, ice risk per route, gritter assignment, replay vs precautionary runs |
| Interface | `api.py` | FastAPI endpoints for forecast, plan and metrics |

The model is trained on the first 75% of the data (in time order) and tested on the last 25%, which it never sees during training.

## 1. Set up

```bash
cd floodcrew-ml
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Run everything on simulated data (works offline)

```bash
python -m floodcrew.train --data synthetic
python -m floodcrew.evaluate --data synthetic --crews 3
python -m floodcrew.ice --gritters 2
uvicorn api:app --reload
```

Then open http://127.0.0.1:8000/docs and try `/plan`.

## 3. Switch to real Environment Agency data

Find the Tees gauges and nearby rain gauges:

```bash
python -m floodcrew.fetch_ea discover
```

Copy the station references for Broken Scar, Low Moor, Yarm and Stockton into `ea_station` in `floodcrew/config.py`. If a gauge isn't listed, pick the nearest Tees gauge and rename it. Then download and train:

```bash
python -m floodcrew.fetch_ea download --start 2025-01-01 --end 2025-11-01
python -m floodcrew.train --data data/tees_hourly.csv
python -m floodcrew.evaluate --data data/tees_hourly.csv --crews 3
```

In `api.py`, change `DATA = "synthetic"` to `DATA = "data/tees_hourly.csv"`.

Notes:
- The real-time API is capped at 10,000 readings per request, so the downloader fetches one month at a time. If older months come back empty, use a more recent range, or take quality-checked history from the EA Hydrology service and save it in the same CSV format (columns: time, broken, lowmoor, yarm, stockton, rain).
- Warning levels are estimated as the level exceeded 0.7% of the time. If you know the official EA thresholds for each gauge, use those instead.
- `rain_fc_6h` uses the rain that actually fell, with about ±40% random error to mimic a forecast. In live use, replace it with a real rainfall forecast (for example Open-Meteo).

Attribution: this uses Environment Agency flood and river level data from the real-time data API (Beta), Open Government Licence.

## 4. Snow and ice with real data

`floodcrew/ice.py` runs on two simulated winters. For real data, swap `simulate()` for hourly weather from Open-Meteo (temperature_2m, dew_point_2m, cloud_cover, precipitation) for each route's location. If the council can share road sensor temperatures, use them as the target; otherwise estimate road temperature from air temperature and say so in the report.

## 5. What to report

- **Forecast accuracy:** MAE, R², and warning precision/recall for ridge, gradient boosting and persistence (`models/metrics.json`).
- **Decision quality:** sites and protected sites covered in time, FloodCrew vs current practice, for 2, 3 and 5 crews.
- **Trade-offs:** with few crews, FloodCrew puts protected sites first (care home, school, hospital route), so it may cover fewer sites in total. That comes from the protected-site weight, and you can change it.
- **Simon's model:** Intelligence (forecast, risk), Design (optimiser, what-if), Choice (officer approval), Review (evaluation).
