"""Gauges, sites and settings.

Gauges are listed upstream -> downstream. After running `python -m floodcrew.fetch_ea discover`,
paste the real Environment Agency station references into `ea_station` below.
"""
HORIZON_H = 6          # forecast horizon in hours
TRAIN_FRACTION = 0.75  # time-based split: first 75% train, last 25% test

GAUGES = [
    # id, display name, EA station reference (fill in after discovery), synthetic settings
    {"id": "broken",   "name": "Broken Scar", "ea_station": "", "base": 0.55, "gain": 0.050, "lag": 3,  "k": 6},
    {"id": "lowmoor",  "name": "Low Moor",    "ea_station": "", "base": 0.70, "gain": 0.054, "lag": 6,  "k": 8},
    {"id": "yarm",     "name": "Yarm",        "ea_station": "", "base": 0.85, "gain": 0.058, "lag": 9,  "k": 10},
    {"id": "stockton", "name": "Stockton",    "ea_station": "", "base": 1.10, "gain": 0.050, "lag": 11, "k": 11},
]

# Rainfall: EA rain gauges within this radius are averaged into one catchment series
RAIN_SEARCH = {"lat": 54.52, "long": -1.45, "dist_km": 25}

# Sites the officer protects. offset = metres above the gauge warning level at which the site floods.
SITES = [
    {"id": "care",     "name": "Yarm care home",         "gauge": "yarm",     "offset": 0.00, "homes": 40,  "type": "Care home",      "protected": True,  "x": 236, "y": 546},
    {"id": "yarmhs",   "name": "Yarm High Street",       "gauge": "yarm",     "offset": 0.25, "homes": 140, "type": "Homes & shops",  "protected": False, "x": 205, "y": 505},
    {"id": "eagle",    "name": "Eaglescliffe riverside", "gauge": "yarm",     "offset": 0.45, "homes": 60,  "type": "Homes",          "protected": False, "x": 290, "y": 440},
    {"id": "stockrs",  "name": "Stockton riverside",     "gauge": "stockton", "offset": 0.10, "homes": 210, "type": "Homes",          "protected": False, "x": 410, "y": 330},
    {"id": "school",   "name": "Thornaby school",        "gauge": "stockton", "offset": 0.15, "homes": 0,   "type": "School",         "protected": True,  "x": 520, "y": 236},
    {"id": "hosp",     "name": "Hospital access road",   "gauge": "stockton", "offset": 0.30, "homes": 0,   "type": "Hospital route", "protected": True,  "x": 700, "y": 430},
    {"id": "lowmoorf", "name": "Low Moor farms",         "gauge": "lowmoor",  "offset": 0.20, "homes": 12,  "type": "Farms",          "protected": False, "x": 110, "y": 640},
]
DEPOT = {"id": "depot", "name": "Middlesbrough depot", "x": 775, "y": 350}
CREWS = ["Marco Santos", "Liam Hart", "Amara Okafor", "Daniel Adeyemi", "Omar Haddad"]

# Decision rules (knowledge base)
PROTECTED_WEIGHT = 60      # impact points added per protected site (multiplied by the what-if weight)
MIN_SLOT_PROB = 0.15       # only plan for sites with at least this flood probability
CONFIDENCE_AUTO = 0.70     # auto-approve only when the forecast is at least this confident
ROAD_SPEED_KMH = 30
TRAVEL_WEIGHT = 0.6        # value lost per minute of travel
MAP_KM_PER_UNIT = 0.03
