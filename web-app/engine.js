/* FloodCrew IDSS engine: data, forecast model, rules, optimiser, evaluation.
   Runs in the browser and in Node (for testing). */
(function (root) {
'use strict';

/* ---------- seeded random ---------- */
function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* ---------- gauges and sites (simulated Tees catchment) ---------- */
var GAUGES = [
  { id: 'broken', name: 'Broken Scar', base: 0.55, gain: 0.050, lag: 3, k: 6, warn: 2.3 },
  { id: 'lowmoor', name: 'Low Moor', base: 0.70, gain: 0.054, lag: 6, k: 8, warn: 2.6 },
  { id: 'yarm', name: 'Yarm', base: 0.85, gain: 0.058, lag: 9, k: 10, warn: 3.0 },
  { id: 'stockton', name: 'Stockton', base: 1.10, gain: 0.050, lag: 11, k: 11, warn: 3.0 }
];
var SITES = [
  { id: 'care', name: 'Yarm care home', gauge: 'yarm', offset: 0.00, homes: 40, type: 'Care home', prot: true, x: 236, y: 546 },
  { id: 'yarmhs', name: 'Yarm High Street', gauge: 'yarm', offset: 0.25, homes: 140, type: 'Homes & shops', prot: false, x: 205, y: 505 },
  { id: 'eagle', name: 'Eaglescliffe riverside', gauge: 'yarm', offset: 0.45, homes: 60, type: 'Homes', prot: false, x: 290, y: 440 },
  { id: 'stockrs', name: 'Stockton riverside', gauge: 'stockton', offset: 0.10, homes: 210, type: 'Homes', prot: false, x: 410, y: 330 },
  { id: 'school', name: 'Thornaby school', gauge: 'stockton', offset: 0.15, homes: 0, type: 'School', prot: true, x: 520, y: 236 },
  { id: 'hosp', name: 'Hospital access road', gauge: 'stockton', offset: 0.3, homes: 0, type: 'Hospital route', prot: true, x: 700, y: 430 },
  { id: 'lowmoorf', name: 'Low Moor farms', gauge: 'lowmoor', offset: 0.20, homes: 12, type: 'Farms', prot: false, x: 110, y: 640 }
];
var DEPOT = { x: 775, y: 350, name: 'Middlesbrough depot' };
var CREWS = [
  { id: 'c1', name: 'Marco Santos' }, { id: 'c2', name: 'Liam Hart' }, { id: 'c3', name: 'Amara Okafor' },
  { id: 'c4', name: 'Daniel Adeyemi' }, { id: 'c5', name: 'Omar Haddad' }
];

/* ---------- simulated dataset: 2 years hourly ---------- */
function simulate(seed) {
  var r = rng(seed || 7), H = 24 * 365 * 2, rain = new Float64Array(H), i, t;
  // storms: seasonal Poisson arrivals
  t = 0;
  while (t < H) {
    var doy = (t / 24 + 90) % 365, winter = 0.5 + 0.5 * Math.cos(2 * Math.PI * (doy - 15) / 365);
    var rate = 1 / (24 * (7 - 4 * winter));            // mean gap 3 to 7 days
    t += Math.max(1, Math.round(-Math.log(1 - r()) / rate));
    var dur = 4 + Math.floor(r() * 30), peak = 0.5 + Math.pow(r(), 2.2) * (5 + 6 * winter);
    for (i = 0; i < dur && t + i < H; i++) rain[t + i] += peak * Math.sin(Math.PI * (i + .5) / dur) * (0.6 + 0.8 * r());
  }
  // antecedent wetness index (soil moisture proxy)
  var api = new Float64Array(H), w = 0;
  for (i = 0; i < H; i++) { w = w * 0.985 + rain[i]; api[i] = w; }
  // effective rain: wetter soil -> more runoff (nonlinear)
  var eff = new Float64Array(H);
  for (i = 0; i < H; i++) eff[i] = rain[i] * (0.25 + 0.75 * (1 - Math.exp(-api[i] / 60)));
  var levels = {};
  GAUGES.forEach(function (g, gi) {
    var L = new Float64Array(H), K = 48, uh = [], s = 0, k;
    for (k = 0; k < K; k++) { var x = k / g.k; uh.push(x * Math.exp(-x)); s += uh[k]; }
    for (k = 0; k < K; k++) uh[k] /= s;
    var noiseR = rng((seed || 7) * 31 + gi);
    for (i = 0; i < H; i++) {
      var acc = 0;
      for (k = 0; k < K; k++) { var j = i - g.lag - k; if (j >= 0) acc += uh[k] * eff[j]; }
      var doy2 = (i / 24 + 90) % 365, season = 0.12 * Math.cos(2 * Math.PI * (doy2 - 15) / 365);
      L[i] = g.base + season + g.gain * 11 * Math.pow(acc, 0.8) + 0.02 * gauss(noiseR);
    }
    levels[g.id] = L;
    var srt = Array.prototype.slice.call(L).sort(function (a, b) { return a - b; });
    g.warn = Math.round(srt[Math.floor(srt.length * 0.993)] * 20) / 20;   // flood warning level: top 0.7% of hours
  });
  // rain forecast error: forecasts are never perfect (about +/-40%)
  var fe = new Float64Array(H), fr = rng((seed || 7) * 97);
  for (i = 0; i < H; i++) fe[i] = Math.exp(0.4 * gauss(fr) - 0.08);
  return { H: H, rain: rain, api: api, levels: levels, fcErr: fe, start: Date.UTC(2023, 3, 1) };
}

/* ---------- features for a 6-hour-ahead forecast ---------- */
var HORIZON = 6;
var FEATS = ['Level now', 'Rise last 3h', 'Rise last 6h', 'Upstream level', 'Upstream rise 3h', 'Rain last 6h', 'Rain last 24h', 'Rain forecast next 6h', 'Soil wetness', 'Rain x wetness'];
function upstreamOf(gid) { var ix = GAUGES.findIndex(function (g) { return g.id === gid; }); return GAUGES[Math.max(0, ix - 1)].id; }
function sumRain(D, a, b) { var s = 0; for (var i = Math.max(0, a); i < Math.min(D.H, b); i++) s += D.rain[i]; return s; }
function features(D, gid, t, extraRain) {
  var L = D.levels[gid], U = D.levels[upstreamOf(gid)];
  var fr = sumRain(D, t + 1, t + 1 + HORIZON) * D.fcErr[t] + (extraRain || 0);   // forecast rain with realistic error, plus what-if
  var wet = Math.min(1, D.api[t] / 120);
  return [L[t], L[t] - L[t - 3], L[t] - L[t - 6], U[t], U[t] - U[t - 3], sumRain(D, t - 5, t + 1), sumRain(D, t - 23, t + 1), fr, wet, fr * wet];
}

/* ---------- ridge regression (closed form) ---------- */
function solve(A, b) { // Gaussian elimination
  var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
  for (var c = 0; c < n; c++) {
    var p = c; for (var r2 = c + 1; r2 < n; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[p][c])) p = r2;
    var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
    for (r2 = 0; r2 < n; r2++) if (r2 !== c) { var f = M[r2][c] / M[c][c]; for (var k = c; k <= n; k++) M[r2][k] -= f * M[c][k]; }
  }
  return M.map(function (r, i) { return r[n] / r[i]; });
}
function trainRidge(X, y, lambda) {
  var n = X.length, d = X[0].length, mu = [], sd = [], j, i;
  for (j = 0; j < d; j++) { var m = 0; for (i = 0; i < n; i++) m += X[i][j]; m /= n; var v = 0; for (i = 0; i < n; i++) v += (X[i][j] - m) * (X[i][j] - m); mu.push(m); sd.push(Math.sqrt(v / n) || 1); }
  var ym = 0; for (i = 0; i < n; i++) ym += y[i]; ym /= n;
  var A = [], b = [];
  for (j = 0; j < d; j++) { A.push(new Array(d).fill(0)); b.push(0); }
  for (i = 0; i < n; i++) {
    var z = X[i].map(function (x, k) { return (x - mu[k]) / sd[k]; }), yy = y[i] - ym;
    for (j = 0; j < d; j++) { b[j] += z[j] * yy; for (var k = 0; k < d; k++) A[j][k] += z[j] * z[k]; }
  }
  for (j = 0; j < d; j++) A[j][j] += lambda;
  var w = solve(A, b);
  return { w: w, mu: mu, sd: sd, ym: ym, predict: function (x) { var s = ym; for (var k = 0; k < d; k++) s += w[k] * (x[k] - mu[k]) / sd[k]; return s; },
    contrib: function (x) { return x.map(function (v, k) { return w[k] * (v - mu[k]) / sd[k]; }); } };
}

/* ---------- train + evaluate per gauge (time split: first 75% train) ---------- */
function normCdf(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
function buildModels(D) {
  var split = Math.floor(D.H * 0.75), models = {};
  GAUGES.forEach(function (g) {
    var X = [], y = [], t;
    for (t = 30; t < split - HORIZON; t += 1) { X.push(features(D, g.id, t)); y.push(D.levels[g.id][t + HORIZON]); }
    var m = trainRidge(X, y, 1.0), res = 0, n = 0;
    for (var i = 0; i < X.length; i += 3) { var e = y[i] - m.predict(X[i]); res += e * e; n++; }
    m.sigma = Math.sqrt(res / n);
    // test metrics
    var L = D.levels[g.id], ae = 0, se = 0, aeP = 0, seP = 0, sst = 0, ys = [], tp = 0, fp = 0, fn = 0, tn = 0, tpP = 0, fpP = 0, fnP = 0, series = [];
    for (t = split; t < D.H - HORIZON; t++) ys.push(L[t + HORIZON]);
    var ymean = ys.reduce(function (a, b) { return a + b; }, 0) / ys.length;
    for (t = split; t < D.H - HORIZON; t++) {
      var truth = L[t + HORIZON], pred = m.predict(features(D, g.id, t)), pers = L[t];
      ae += Math.abs(truth - pred); se += (truth - pred) * (truth - pred); aeP += Math.abs(truth - pers); seP += (truth - pers) * (truth - pers); sst += (truth - ymean) * (truth - ymean);
      var a = truth >= g.warn, pP = 1 - normCdf((g.warn - pred) / m.sigma) >= 0.5, pp = pers >= g.warn;
      if (a && pP) tp++; else if (!a && pP) fp++; else if (a && !pP) fn++; else tn++;
      if (a && pp) tpP++; else if (!a && pp) fpP++; else if (a && !pp) fnP++;
      series.push([t, truth, pred]);
    }
    var N = ys.length;
    m.metrics = { mae: ae / N, rmse: Math.sqrt(se / N), r2: 1 - se / sst, maeP: aeP / N, rmseP: Math.sqrt(seP / N), r2P: 1 - seP / sst,
      skill: 1 - se / seP, tp: tp, fp: fp, fn: fn, tn: tn, prec: tp / Math.max(1, tp + fp), rec: tp / Math.max(1, tp + fn),
      precP: tpP / Math.max(1, tpP + fpP), recP: tpP / Math.max(1, tpP + fnP), nTrain: X.length, nTest: N };
    m.series = series; models[g.id] = m;
  });
  return { models: models, split: split };
}

/* ---------- forecast + site risk (knowledge base rules) ---------- */
function forecastAll(D, M, t, extraRain) {
  var out = {};
  GAUGES.forEach(function (g) {
    var m = M.models[g.id], x = features(D, g.id, t, extraRain), p = m.predict(x), c = m.contrib(x);
    out[g.id] = { now: D.levels[g.id][t], pred: p, lo: p - 1.645 * m.sigma, hi: p + 1.645 * m.sigma, sigma: m.sigma,
      pExceed: 1 - normCdf((g.warn - p) / m.sigma), contrib: c, x: x };
  });
  return out;
}
function siteRisk(F, protWeight) {
  return SITES.map(function (s) {
    var f = F[s.gauge], g = GAUGES.find(function (q) { return q.id === s.gauge; }), thr = g.warn + s.offset;
    var p = 1 - normCdf((thr - f.pred) / f.sigma), impact = s.homes + (s.prot ? 60 * protWeight : 0);
    var reasons = [];
    reasons.push(g.name + ' ' + f.pred.toFixed(2) + ' m (floods at ' + thr.toFixed(2) + ' m)');
    if (s.prot) reasons.push('Protected site (' + s.type.toLowerCase() + ')');
    if (s.homes) reasons.push(s.homes + ' homes at risk');
    var top = f.contrib.map(function (v, k) { return [FEATS[k], v]; }).sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); }).slice(0, 2);
    return { site: s, p: p, impact: impact, score: p * impact, thr: thr, reasons: reasons, drivers: top };
  }).sort(function (a, b) { return b.score - a.score; });
}

/* ---------- Hungarian algorithm (min cost assignment) ---------- */
function hungarian(cost) {
  var n = cost.length, m = cost[0].length, N = Math.max(n, m), INF = 1e18, i, j;
  var a = []; for (i = 0; i < N; i++) { a.push([]); for (j = 0; j < N; j++) a[i].push(i < n && j < m ? cost[i][j] : 0); }
  var u = new Array(N + 1).fill(0), v = new Array(N + 1).fill(0), p = new Array(N + 1).fill(0), way = new Array(N + 1).fill(0);
  for (i = 1; i <= N; i++) {
    p[0] = i; var j0 = 0, minv = new Array(N + 1).fill(INF), used = new Array(N + 1).fill(false);
    do {
      used[j0] = true; var i0 = p[j0], delta = INF, j1 = 0;
      for (j = 1; j <= N; j++) if (!used[j]) { var cur = a[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } }
      for (j = 0; j <= N; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { var jj = way[j0]; p[j0] = p[jj]; j0 = jj; } while (j0);
  }
  var res = new Array(n).fill(-1); for (j = 1; j <= N; j++) if (p[j] && p[j] <= n && j <= m) res[p[j] - 1] = j - 1;
  return res;
}

/* ---------- crew plan: optimise value of protection minus travel ---------- */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) * 0.03; } // map units -> km (approx)
function plan(risks, crewState, opts) {
  opts = opts || {};
  var speed = opts.speed || 30, travelW = opts.travelW == null ? 0.6 : opts.travelW;
  var slots = [], cov = opts.covered || {};
  risks.forEach(function (r) { if (r.p > 0.15) { var have = cov[r.site.id] || 0; if (have < 1) slots.push({ r: r, k: 1, val: r.score }); if (r.score > 150 && have < 2) slots.push({ r: r, k: 2, val: r.score * 0.45 }); } });
  var crews = crewState.filter(function (c) { return c.available; });
  if (!crews.length) return { moves: [], slots: slots };
  var cost = crews.map(function (c) {
    var pos = c.at ? SITES.find(function (s) { return s.id === c.at; }) : DEPOT;
    return slots.map(function (sl) { var mins = dist(pos, sl.r.site) / speed * 60; return -(sl.val - travelW * mins); }).concat(crews.map(function () { return 0; })); // standby columns
  });
  var asg = hungarian(cost), moves = [];
  crews.forEach(function (c, i) {
    var j = asg[i], from = c.at || 'depot';
    if (j < 0 || j >= slots.length || -cost[i][j] <= 0) { moves.push({ crew: c, from: from, to: from === 'depot' ? 'depot' : from, standby: true, value: 0, mins: 0 }); return; }
    var sl = slots[j], pos = c.at ? SITES.find(function (s) { return s.id === c.at; }) : DEPOT;
    moves.push({ crew: c, from: from, to: sl.r.site.id, risk: sl.r, value: sl.val, mins: dist(pos, sl.r.site) / speed * 60, second: sl.k === 2 });
  });
  return { moves: moves, slots: slots };
}

/* ---------- approval rules ---------- */
function approvals(moves, risks, confThreshold) {
  var byId = {}; risks.forEach(function (r) { byId[r.site.id] = r; });
  var counts = {}; moves.forEach(function (m) { if (!m.standby) counts[m.to] = (counts[m.to] || 0) + 1; });
  var active = moves.filter(function (m) { return !m.standby; }).length;
  return moves.map(function (m) {
    if (m.standby || m.from === m.to) return Object.assign({ status: 'none', why: [] }, m);
    var why = [], high = false, fromR = byId[m.from];
    if (fromR && fromR.site.prot && fromR.p > 0.3) {
      var stillCovered = moves.some(function (o) { return o !== m && o.to === m.from && !o.standby; });
      if (!stillCovered) { high = true; why.push('Leaves ' + fromR.site.name + ' uncovered'); }
    }
    var conf = Math.max(m.risk.p, 1 - m.risk.p);
    if (conf < confThreshold) { high = true; why.push('Unsure forecast (' + Math.round(conf * 100) + '%)'); }
    if (active >= 3 && counts[m.to] / active > 0.5) { high = true; why.push('Too many crews in one area'); }
    if (!high) why.push('Low risk');
    return Object.assign({ status: high ? 'approve' : 'auto', why: why }, m);
  });
}

/* ---------- storms in the test period (for replay + evaluation) ---------- */
function findStorms(D, M, n) {
  var L = D.levels.yarm, g = GAUGES[2], out = [], t = M.split + 48;
  while (t < D.H - 48 && out.length < n) {
    if (L[t] >= g.warn - 0.1 && L[t - 1] < g.warn - 0.1) {
      var peak = t; for (var k = t; k < Math.min(D.H, t + 48); k++) if (L[k] > L[peak]) peak = k;
      out.push({ start: t - 18, peak: peak, level: L[peak] }); t += 96;
    } else t++;
  }
  return out.sort(function (a, b) { return b.level - a.level; });
}

/* ---------- policy evaluation: FloodCrew vs reactive dispatch ---------- */
function simulatePolicy(D, M, storm, policy, nCrews, protWeight) {
  var crews = CREWS.slice(0, nCrews).map(function (c) { return { id: c.id, at: null, available: true, busyUntil: 0, dest: null }; });
  var protectedAt = {}, floodedAt = {}, t;
  var posOf = function (c) { return c.at ? SITES.find(function (q) { return q.id === c.at; }) : DEPOT; };
  for (t = storm.start; t < storm.start + 72 && t < D.H - HORIZON; t++) {
    crews.forEach(function (c) { if (c.dest && t >= c.busyUntil) { c.at = c.dest; c.dest = null; } });
    SITES.forEach(function (s) { var g = GAUGES.find(function (q) { return q.id === s.gauge; });
      if (floodedAt[s.id] == null && D.levels[s.gauge][t] >= g.warn + s.offset) { floodedAt[s.id] = t;
        if (crews.some(function (c) { return c.at === s.id && !c.dest; })) protectedAt[s.id] = t; } });  // protected = crew on site when it floods
    var free = crews.filter(function (c) { return !c.dest; });
    if (!free.length) continue;
    if (policy === 'floodcrew') {
      var F = forecastAll(D, M, t, 0), R = siteRisk(F, protWeight), pNow = {};
      R.forEach(function (r) { pNow[r.site.id] = r.p; });
      free = free.filter(function (c) { return !c.at || (pNow[c.at] || 0) < 0.1 || floodedAt[c.at] != null; });   // re-task crews whose site is safe or already flooded
      var cov = {}; crews.forEach(function (c) { if (free.indexOf(c) < 0) { var k = c.dest || c.at; if (k) cov[k] = (cov[k] || 0) + 1; } });
      var P = plan(R, free.map(function (c) { return { id: c.id, at: c.at, available: true }; }), { covered: cov });
      P.moves.forEach(function (mv) { if (!mv.standby && mv.to !== mv.from) { var c = crews.find(function (q) { return q.id === mv.crew.id; }); c.dest = mv.to; c.busyUntil = t + Math.max(1, Math.ceil(mv.mins / 60)); } });
    } else { // current practice: wait for the official warning (gauge reaches its warning level), then send the nearest crew, most homes first
      SITES.filter(function (s) { var g2 = GAUGES.find(function (q) { return q.id === s.gauge; }); return D.levels[s.gauge][t] >= g2.warn && !crews.some(function (c) { return c.at === s.id || c.dest === s.id; }); })
        .sort(function (a, b) { return (b.homes + (b.prot ? 60 : 0)) - (a.homes + (a.prot ? 60 : 0)); })
        .forEach(function (s) { var f2 = crews.filter(function (c) { return !c.dest; }); if (!f2.length) return;
          f2.sort(function (a, b) { return dist(posOf(a), s) - dist(posOf(b), s); });
          var c = f2[0]; c.dest = s.id; c.busyUntil = t + Math.max(1, Math.ceil(dist(posOf(c), s) / 30)); });
    }
  }
  var flooded = SITES.filter(function (s) { return floodedAt[s.id] != null; }), inTime = 0, homes = 0, homesAll = 0, prot = 0, protAll = 0;
  flooded.forEach(function (s) { homesAll += s.homes; if (s.prot) protAll++;
    if (protectedAt[s.id] != null) { inTime++; homes += s.homes; if (s.prot) prot++; } });
  return { flooded: flooded.length, inTime: inTime, homes: homes, homesAll: homesAll, prot: prot, protAll: protAll };
}

var API = { GAUGES: GAUGES, SITES: SITES, DEPOT: DEPOT, CREWS: CREWS, FEATS: FEATS, HORIZON: HORIZON, simulate: simulate, buildModels: buildModels,
  forecastAll: forecastAll, siteRisk: siteRisk, plan: plan, approvals: approvals, findStorms: findStorms, simulatePolicy: simulatePolicy, hungarian: hungarian, features: features };
if (typeof module !== 'undefined') module.exports = API; else root.FC = API;
})(this);
