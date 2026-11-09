"""Build index.html from ui.html + engine.js + ice.js + avatars.  Run: python build.py"""
import base64, json, os
h = os.path.dirname(os.path.abspath(__file__))
r = lambda f: open(os.path.join(h, f), encoding="utf-8").read()
order = {"c1": 3, "c2": 1, "c3": 2, "c4": 4, "c5": 5}
av = {k: "data:image/svg+xml;base64," + base64.b64encode(open(os.path.join(h, "avatars", f"av{n}.svg"), "rb").read()).decode() for k, n in order.items()}
out = r("ui.html").replace("@@ENGINE@@", r("engine.js")).replace("@@ICE@@", r("ice.js")).replace("@@AVATARS@@", json.dumps(av))
open(os.path.join(h, "index.html"), "w", encoding="utf-8").write(out)
print("Built index.html")
