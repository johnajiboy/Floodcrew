# FloodCrew – Intelligent Decision Support System

Decision support for sending council crews and gritters during floods, snow and black ice, with public alerts.

## Live site
Hosted on Vercel at **https://floodcrew.vercel.app** (deploys automatically from `main`).
- Public page: https://floodcrew.vercel.app/landing-page/index.html
- Officer app: https://floodcrew.vercel.app/web-app/index.html

The old address, `python-ml-one.vercel.app`, redirects here.

## Folders
| Folder | What it is |
|---|---|
| `web-app/` | Officer (staff) app: Monitor, Plan, Decide, Evaluate. Open `index.html` in a browser. |
| `landing-page/` | Public page: globe, live alerts, safer route, live map, TS postcode lookup and sign-up. Open `index.html`. |
| `python-ml/` | Python models trained on real Environment Agency river data and Open-Meteo weather (see its README). |
| `demo/` | Earlier clickable demo (officer + crew views). |
| `docs/` | Proposal and write-up (PDF, Word, HTML) and the script that makes them. |

## Run the web app
Just open `web-app/index.html`. To rebuild after editing:
```
cd web-app
python build.py
```
- `engine.js` – flood forecasting (ridge regression), risk, Hungarian assignment, approval rules, replay evaluation
- `ice.js` – road temperature model and gritting plan
- `ui.html` – the interface (placeholders are filled by build.py)
- `make_map.py` – draws the street-style map (`python make_map.py`, then paste base.svg into `var BASE` in ui.html)

## Rebuild the public page
Edit `landing-page/src.html`, then:
```
cd landing-page
python build.py
```
- `land.json` – world map data for the globe (filled into `@@LAND@@` by build.py)
- The live map uses a copy of `var BASE` from `web-app/ui.html`; if you redraw the map, paste it into `src.html` too

## Run the Python project (real data)
```
cd python-ml
pip install -r requirements.txt
python -m floodcrew.fetch_ea          # EA river levels + rainfall, 2023-01-01 to today, resampled to hourly
python -m floodcrew.train
python -m floodcrew.evaluate
python -m floodcrew.ice --gritters 2  # Open-Meteo weather for Middlesbrough, winters 2024/25 and 2025/26
uvicorn api:app --reload
```
Results are written to `python-ml/models/metrics.json`.

Real data sources:
- **River levels:** Environment Agency Hydrology API (15-minute, quality-checked history) for Broken Scar, Low Moor, Yarm and Stockton, topped up with the EA real-time flood-monitoring API for the newest readings.
- **Rainfall:** the six nearest EA rain gauges with good coverage, averaged each hour.
- **Snow & ice:** Open-Meteo historical weather API (free, no key): hourly air temperature, dew point, precipitation and cloud cover for Middlesbrough. Road temperature is estimated from these, not measured.

Add `--data synthetic` (train, evaluate) or `--weather synthetic` (ice) to run offline on simulated data.

## Rebuild the proposal
```
cd docs
npm install docx
node make_proposal.js
```

Note: the Python models use real data. The web app and public page still run their own simulated data in the browser.
