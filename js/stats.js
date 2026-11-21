// stats.js — a small, honest statistics engine that runs in the browser.
// Random sampling + the classic tests + rough power, with distribution
// CDFs implemented from standard algorithms (no dependencies).

// ---------- random sampling ----------

// Standard normal via Box–Muller.
export function gaussian(mean = 0, sd = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + sd * z;
}

export function bernoulli(p) {
  return Math.random() < p ? 1 : 0;
}

export function sampleNormal(n, mean, sd) {
  return Array.from({ length: n }, () => gaussian(mean, sd));
}

// ---------- descriptive ----------

export const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

export function variance(a) {
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);
}

export const sd = (a) => Math.sqrt(variance(a));

// ---------- special functions ----------

// Log-gamma (Lanczos approximation).
function gammln(xx) {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let x = xx, y = xx;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued fraction for the incomplete beta.
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a,b).
function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// Lower regularized incomplete gamma P(a,x) via series / continued fraction.
function gammp(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // series
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 3e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammln(a));
  }
  // continued fraction for Q, then 1-Q
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - gammln(a)) * h;
  return 1 - q;
}

// Normal CDF via erf (Abramowitz & Stegun 7.1.26).
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export function normCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Two-sided p-value from a t statistic.
function tTwoSidedP(t, df) {
  const x = df / (df + t * t);
  return betai(df / 2, 0.5, x);
}

// Upper-tail p-value for an F statistic.
function fUpperP(F, d1, d2) {
  if (F <= 0) return 1;
  const x = d2 / (d2 + d1 * F);
  return betai(d2 / 2, d1 / 2, x);
}

// Upper-tail p-value for a chi-square statistic.
function chiSqUpperP(chi2, df) {
  if (chi2 <= 0) return 1;
  return 1 - gammp(df / 2, chi2 / 2);
}

// ---------- the tests ----------

// Welch's two-sample t-test (unequal variances).
export function twoSampleT(a, b) {
  const ma = mean(a), mb = mean(b);
  const va = variance(a), vb = variance(b);
  const na = a.length, nb = b.length;
  const se = Math.sqrt(va / na + vb / nb);
  const t = (ma - mb) / se;
  const df =
    Math.pow(va / na + vb / nb, 2) /
    (Math.pow(va / na, 2) / (na - 1) + Math.pow(vb / nb, 2) / (nb - 1));
  return { t, df, p: tTwoSidedP(t, df), estimate: ma - mb };
}

// Paired t-test.
export function pairedT(a, b) {
  const d = a.map((x, i) => x - b[i]);
  const md = mean(d), n = d.length;
  const se = sd(d) / Math.sqrt(n);
  const t = md / se;
  const df = n - 1;
  return { t, df, p: tTwoSidedP(t, df), estimate: md };
}

// One-way ANOVA.
export function oneWayAnova(groups) {
  const all = groups.flat();
  const grand = mean(all);
  let ssb = 0, ssw = 0;
  for (const g of groups) {
    const mg = mean(g);
    ssb += g.length * (mg - grand) * (mg - grand);
    for (const x of g) ssw += (x - mg) * (x - mg);
  }
  const k = groups.length, N = all.length;
  const dfb = k - 1, dfw = N - k;
  const F = (ssb / dfb) / (ssw / dfw);
  return { F, dfb, dfw, p: fUpperP(F, dfb, dfw) };
}

// Simple linear regression y ~ x: slope, r, and a t-test on the slope.
export function linearRegression(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) * (x[i] - mx);
    syy += (y[i] - my) * (y[i] - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = sxy / Math.sqrt(sxx * syy);
  // residual SE and slope SE
  const ssRes = syy - slope * sxy;
  const df = n - 2;
  const seSlope = Math.sqrt(ssRes / df / sxx);
  const t = slope / seSlope;
  return { slope, intercept, r, df, p: tTwoSidedP(t, df) };
}

// Chi-square test of independence for an r×c table of counts.
export function chiSquare(table) {
  const rows = table.length, cols = table[0].length;
  const rowSum = table.map((r) => r.reduce((s, x) => s + x, 0));
  const colSum = Array.from({ length: cols }, (_, j) =>
    table.reduce((s, r) => s + r[j], 0)
  );
  const total = rowSum.reduce((s, x) => s + x, 0);
  let chi2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const exp = (rowSum[i] * colSum[j]) / total;
      if (exp > 0) chi2 += Math.pow(table[i][j] - exp, 2) / exp;
    }
  }
  const df = (rows - 1) * (cols - 1);
  return { chi2, df, p: chiSqUpperP(chi2, df) };
}

// Logistic regression y ~ x (single continuous predictor) via gradient descent.
// Returns the slope coefficient and an approximate Wald p-value.
export function logisticRegression(x, y, iters = 4000, lr = 0.1) {
  // standardize x for stable fitting
  const mx = mean(x), sx = sd(x) || 1;
  const z = x.map((v) => (v - mx) / sx);
  let b0 = 0, b1 = 0;
  const n = x.length;
  for (let it = 0; it < iters; it++) {
    let g0 = 0, g1 = 0;
    for (let i = 0; i < n; i++) {
      const p = 1 / (1 + Math.exp(-(b0 + b1 * z[i])));
      const err = p - y[i];
      g0 += err;
      g1 += err * z[i];
    }
    b0 -= (lr * g0) / n;
    b1 -= (lr * g1) / n;
  }
  // approximate SE of b1 from the Fisher information on standardized x
  let info = 0;
  for (let i = 0; i < n; i++) {
    const p = 1 / (1 + Math.exp(-(b0 + b1 * z[i])));
    info += p * (1 - p) * z[i] * z[i];
  }
  const seStd = info > 0 ? 1 / Math.sqrt(info) : Infinity;
  const wald = b1 / seStd;
  const p = 2 * (1 - normCdf(Math.abs(wald)));
  // report slope + intercept on the original x scale (intercept lets us draw the curve)
  const slope = b1 / sx;
  const intercept = b0 - (b1 * mx) / sx;
  return { slope, intercept, p, estimate: slope };
}

// ---------- approximate power ----------

// Two-sided power for a given standardized effect and total design.
// model: 'two' (n per group), 'paired' (n pairs), 'generic' (n observations).
export function approxPower(effect, n, model = "two", alpha = 0.05) {
  const zcrit = 1.959963985; // two-sided 0.05 critical z
  const za = alpha === 0.05 ? zcrit : -quantileNorm(alpha / 2);
  let ncp;
  if (model === "two") ncp = effect * Math.sqrt(n / 2);
  else ncp = effect * Math.sqrt(n); // paired / generic
  // power = P(reject) under the alternative, two-sided
  const power = normCdf(ncp - za) + normCdf(-ncp - za);
  return Math.min(1, Math.max(0, power));
}

// Inverse normal CDF (Acklam) — used only for non-0.05 alpha.
function quantileNorm(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
    138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
    66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
    -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
    3.75440866190742];
  const pl = 0.02425, ph = 1 - pl;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= ph) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}
