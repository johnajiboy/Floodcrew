/* FloodCrew snow & ice module: simulated winter roads, road-temperature forecast, gritting plan and evaluation. */
(function (root) {
'use strict';
var FC = root.FC || (typeof module !== 'undefined' ? require('./engine.js') : null);
function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function normCdf(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }

var ROUTES = [
  { id: 'hosp', name: 'Hospital route', offset: -0.3, impact: 140, prot: true, x: 760, y: 470 },
  { id: 'bus', name: 'Stockton bus route', offset: 0.6, impact: 90, prot: false, x: 440, y: 300 },
  { id: 'school', name: 'Yarm school road', offset: -0.5, impact: 110, prot: true, x: 250, y: 560 },
  { id: 'hill', name: 'Ingleby Barwick hill', offset: -1.1, impact: 80, prot: false, x: 430, y: 560 }
];
var DEPOT = { x: 775, y: 350 }, HZ = 6, RUN_H = 2, SALT_H = 10;
var FEATS = ['Road temp now', 'Road change 3h', 'Air temp now', 'Air forecast +6h', 'Cloud now', 'Cloud forecast', 'Dew point gap', 'Night', 'Hour (cos)', 'Precip last 6h'];

/* two winters (1 Nov - 31 Mar), hourly */
function simulateIce(seed) {
  var r = rng(seed || 11), days = 151, H = 2 * days * 24, i;
  var air = new Float64Array(H), cloud = new Float64Array(H), precip = new Float64Array(H), dew = new Float64Array(H);
  var anom = 0, cl = 0.6, ev = 0;
  for (i = 0; i < H; i++) {
    var d = Math.floor(i / 24) % days, h = i % 24;
    if (h === 0) anom = 0.8 * anom + 1.6 * gauss(r);
    cl = Math.min(1, Math.max(0, cl + 0.12 * gauss(r) - 0.02 * (cl - 0.6)));
    var mean = 5.5 - 4.5 * Math.sin(Math.PI * d / days), amp = 1.5 + 3 * (1 - cl);
    air[i] = mean + anom + amp * Math.sin(2 * Math.PI * (h - 9) / 24) + 0.3 * gauss(r);
    cloud[i] = cl;
    if (ev <= 0 && r() < 0.015 + 0.03 * cl) ev = 2 + Math.floor(r() * 8);
    precip[i] = ev > 0 ? 0.3 + 1.5 * r() * cl : 0; ev--;
    dew[i] = air[i] - (0.5 + 3.5 * (1 - cl)) + 0.3 * gauss(r);
  }
  var road = {};
  ROUTES.forEach(function (rt, k) {
    var R = new Float64Array(H), rr = rng((seed || 11) * 13 + k), v = air[0];
    for (i = 0; i < H; i++) {
      var hh = i % 24, night = hh >= 17 || hh <= 8, day = hh >= 10 && hh <= 15;
      var target = air[i] + rt.offset + (night ? -2.2 * (1 - cloud[i]) : 0) + (day ? 2.2 * (1 - cloud[i]) : 0);
      v = v + 0.35 * (target - v) + 0.15 * gauss(rr); R[i] = v;
    }
    road[rt.id] = R;
  });
  var fe = new Float64Array(H), fc = new Float64Array(H), fr = rng((seed || 11) * 71);
  for (i = 0; i < H; i++) { fe[i] = 1.0 * gauss(fr); fc[i] = 0.15 * gauss(fr); }   // weather forecast error: +/-1 C, cloud +/-0.15
  return { H: H, days: days, air: air, cloud: cloud, precip: precip, dew: dew, road: road, airErr: fe, cloudErr: fc };
}
function icy(W, id, t) { var s = 0; for (var k = Math.max(0, t - 3); k <= t; k++) s += W.precip[k]; return W.road[id][t] <= 0 && (s > 0.1 || W.dew[t] >= W.road[id][t]); }
function feats(W, id, t, extraCold) {
  var R = W.road[id], j = Math.min(W.H - 1, t + HZ), s = 0, k, h = t % 24;
  for (k = Math.max(0, t - 5); k <= t; k++) s += W.precip[k];
  var airF = W.air[j] + W.airErr[t] - (extraCold || 0), cloudF = Math.min(1, Math.max(0, W.cloud[j] + W.cloudErr[t]));
  return [R[t], R[t] - R[Math.max(0, t - 3)], W.air[t], airF, W.cloud[t], cloudF, W.dew[t] - R[t], ((h + HZ) % 24 >= 17 || (h + HZ) % 24 <= 8) ? 1 : 0, Math.cos(2 * Math.PI * ((h + HZ) % 24) / 24), s];
}
function trainRidge(X, y, lambda) { // same closed form as the flood model
  var n = X.length, d = X[0].length, mu = [], sd = [], j, i, k;
  for (j = 0; j < d; j++) { var m = 0; for (i = 0; i < n; i++) m += X[i][j]; m /= n; var v = 0; for (i = 0; i < n; i++) v += (X[i][j] - m) * (X[i][j] - m); mu.push(m); sd.push(Math.sqrt(v / n) || 1); }
  var ym = y.reduce(function (a, b) { return a + b; }, 0) / n, A = [], b = [];
  for (j = 0; j < d; j++) { A.push(new Array(d).fill(0)); b.push(0); }
  for (i = 0; i < n; i++) { var z = X[i].map(function (x, q) { return (x - mu[q]) / sd[q]; }); for (j = 0; j < d; j++) { b[j] += z[j] * (y[i] - ym); for (k = 0; k < d; k++) A[j][k] += z[j] * z[k]; } }
  for (j = 0; j < d; j++) A[j][j] += lambda;
  var M = A.map(function (row, q) { return row.concat([b[q]]); });
  for (var c = 0; c < d; c++) { var p = c; for (var r2 = c + 1; r2 < d; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[p][c])) p = r2; var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
    for (r2 = 0; r2 < d; r2++) if (r2 !== c) { var f = M[r2][c] / M[c][c]; for (k = c; k <= d; k++) M[r2][k] -= f * M[c][k]; } }
  var w = M.map(function (row, q) { return row[d] / row[q]; });
  return { w: w, predict: function (x) { var s = ym; for (var q = 0; q < d; q++) s += w[q] * (x[q] - mu[q]) / sd[q]; return s; } };
}
/* train one model on all routes (route offset is learnt through road temp now), time split 75 / 25 */
function buildIce(W) {
  var split = Math.floor(W.H * 0.75), X = [], y = [], t;
  ROUTES.forEach(function (rt) { for (t = 6; t < split - HZ; t++) { X.push(feats(W, rt.id, t)); y.push(W.road[rt.id][t + HZ]); } });
  var m = trainRidge(X, y, 1), se = 0;
  for (var i = 0; i < X.length; i += 4) { var e = y[i] - m.predict(X[i]); se += e * e; }
  m.sigma = Math.sqrt(se / Math.ceil(X.length / 4));
  var ae = 0, aeP = 0, n = 0, tp = 0, fp = 0, fn = 0, tpA = 0, fpA = 0, fnA = 0;
  ROUTES.forEach(function (rt) {
    for (t = split; t < W.H - HZ; t++) {
      var x = feats(W, rt.id, t), truth = W.road[rt.id][t + HZ], pred = m.predict(x);
      ae += Math.abs(truth - pred); aeP += Math.abs(truth - W.road[rt.id][t]); n++;
      var actual = icy(W, rt.id, t + HZ), p = iceProb(m, x, pred) >= 0.5, airRule = x[3] <= 1;   // common rule: forecast air temperature 1 C or below
      if (actual && p) tp++; else if (!actual && p) fp++; else if (actual && !p) fn++;
      if (actual && airRule) tpA++; else if (!actual && airRule) fpA++; else if (actual && !airRule) fnA++;
    }
  });
  m.metrics = { mae: ae / n, maeP: aeP / n, prec: tp / Math.max(1, tp + fp), rec: tp / Math.max(1, tp + fn), precA: tpA / Math.max(1, tpA + fpA), recA: tpA / Math.max(1, tpA + fnA), nTest: n, nTrain: X.length };
  return { model: m, split: split };
}
function iceProb(m, x, pred) { var cold = normCdf((0.3 - pred) / m.sigma), wet = Math.min(1, 0.35 + (x[9] > 0.1 ? 0.5 : 0) + (x[6] > -1 ? 0.3 : 0) + 0.3 * x[5]); return cold * wet; }
function routeRisk(W, IM, t, extraCold) {
  return ROUTES.map(function (rt) { var x = feats(W, rt.id, t, extraCold), pred = IM.model.predict(x), p = iceProb(IM.model, x, pred);
    return { route: rt, p: p, pred: pred, now: W.road[rt.id][t], score: p * rt.impact }; }).sort(function (a, b) { return b.score - a.score; });
}
/* ice events in the test period and gritting replay */
function iceEvents(W, from, to) {
  var ev = [];
  ROUTES.forEach(function (rt) { var dry = 99; for (var t = from; t < to; t++) { if (icy(W, rt.id, t)) { if (dry >= 6) ev.push({ id: rt.id, t: t }); dry = 0; } else dry++; } });
  return ev;
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) * 0.03; }
function replayGritting(W, IM, policy, nGritters) {
  var from = IM.split, to = W.H - HZ, treated = {}, runs = 0, t, g = [];
  for (var k = 0; k < nGritters; k++) g.push({ busy: 0 });
  ROUTES.forEach(function (rt) { treated[rt.id] = -99; });
  var wash = function (id, t) { var s = 0; for (var k = treated[id]; k <= t; k++) s += W.precip[k]; return s > 6; };
  var active = function (id, t) { return t - treated[id] <= SALT_H && !wash(id, t); };
  var protectedEv = 0, protAll = 0, protProt = 0, protProtAll = 0, events = iceEvents(W, from, to), evAt = {};
  events.forEach(function (e) { evAt[e.id + ':' + e.t] = 1; });
  for (t = from; t < to; t++) {
    var free = g.filter(function (q) { return q.busy <= t; });
    if (policy === 'floodcrew') {
      var R = routeRisk(W, IM, t, 0).filter(function (r) { return r.p > 0.3 && !(active(r.route.id, t) && t - treated[r.route.id] < SALT_H - 4); });
      if (free.length && R.length) {
        var cost = free.map(function () { return R.map(function (r) { return -(r.score - 0.4 * dist(DEPOT, r.route) / 30 * 60); }); });
        var asg = FC.hungarian(cost);
        free.forEach(function (q, i) { var j = asg[i]; if (j >= 0 && j < R.length && -cost[i][j] > 0) { q.busy = t + RUN_H; treated[R[j].route.id] = t + RUN_H; runs++; } });
      }
    } else { // current practice: precautionary runs at 18:00 and 04:00 when forecast air temperature drops to 1 C or below, fixed priority order
      var h = t % 24;
      if ((h === 18 || h === 4)) {
        var minAir = 99; for (var k2 = 1; k2 <= 14; k2++) minAir = Math.min(minAir, W.air[Math.min(W.H - 1, t + k2)] + W.airErr[t]);
        if (minAir <= 1) { var order = ['hosp', 'bus', 'school', 'hill']; order.forEach(function (id, i) { var q = g[i % nGritters]; var start = Math.max(t, q.busy); q.busy = start + RUN_H; treated[id] = start + RUN_H; runs++; }); }
      }
    }
    ROUTES.forEach(function (rt) { if (evAt[rt.id + ':' + t]) { protAll++; if (rt.prot) protProtAll++; if (active(rt.id, t) && treated[rt.id] <= t) { protectedEv++; if (rt.prot) protProt++; } } });
  }
  return { events: protAll, protectedEv: protectedEv, protEvents: protProtAll, protProtected: protProt, runs: runs };
}
var ICE = { ROUTES: ROUTES, FEATS: FEATS, simulateIce: simulateIce, buildIce: buildIce, routeRisk: routeRisk, replayGritting: replayGritting, iceEvents: iceEvents };
if (typeof module !== 'undefined') module.exports = ICE; else root.ICE = ICE;
})(this);
