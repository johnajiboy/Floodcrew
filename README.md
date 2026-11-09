# FloodCrew – Intelligent Decision Support System

Decision support for sending council crews and gritters during floods, snow and black ice, with public alerts.

## Folders
| Folder | What it is |
|---|---|
| `web-app/` | Officer (staff) app: Monitor, Plan, Decide, Evaluate. Open `index.html` in a browser. |
| `landing-page/` | Public page: globe, live alerts, safer route, postcode sign-up. Open `index.html`. |
| `python-ml/` | Python models with real Environment Agency data option (see its README). |
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

## Run the Python project
```
cd python-ml
pip install -r requirements.txt
python -m floodcrew.train
python -m floodcrew.evaluate
python -m floodcrew.ice --gritters 2
uvicorn api:app --reload
```

## Rebuild the proposal
```
cd docs
npm install docx
node make_proposal.js
```

Note: results use simulated data until real Environment Agency data is downloaded with `python-ml`.
