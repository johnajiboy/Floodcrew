"""Build index.html from src.html + land.json (world map data).  Run: python build.py"""
import os
h = os.path.dirname(os.path.abspath(__file__))
r = lambda f: open(os.path.join(h, f), encoding="utf-8").read()
out = r("src.html").replace("@@LAND@@", r("land.json"))
open(os.path.join(h, "index.html"), "w", encoding="utf-8").write(out)
print("Built index.html")
