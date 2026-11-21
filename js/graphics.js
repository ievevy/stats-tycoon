// graphics.js — the cute layer: little data charts (so the stats are visible),
// a flask mascot that reacts, and a confetti burst. All inline SVG + DOM, no deps.

import { linearRegression, logisticRegression } from "./stats.js";

// palette via CSS vars so it follows light/dark
const INK = "var(--ink)", MUT = "var(--muted)", ACC = "var(--accent)";
const GOOD = "var(--good)", BAD = "var(--bad)", WARN = "var(--warn)", LINE = "var(--line)";

const W = 320, H = 196;
const L = 34, R = 304, T = 30, B = 158; // plot frame

function svg(inner, label) {
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${label}">${inner}</svg>`;
}
function caption(text) {
  return `<text x="${W / 2}" y="16" text-anchor="middle" font-size="12" fill="${MUT}">${text}</text>`;
}
function baseline() {
  return `<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="${LINE}" stroke-width="1.5"/>`;
}
function yScaler(min, max) {
  const pad = (max - min) * 0.12 || 1;
  const lo = min - pad, hi = max + pad;
  return (v) => B - ((v - lo) / (hi - lo)) * (B - T);
}
const jit = (w) => (Math.random() - 0.5) * w;

// dots in vertical columns, with a mean tick per column
function columns(cols, labels, cap, accent = ACC) {
  const all = cols.flat();
  const y = yScaler(Math.min(...all), Math.max(...all));
  const n = cols.length;
  const span = R - L;
  const xs = cols.map((_, i) => L + (span * (i + 0.5)) / n);
  let s = caption(cap) + baseline();
  cols.forEach((col, i) => {
    const cx = xs[i];
    for (const v of col) {
      s += `<circle cx="${(cx + jit(34)).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="${accent}" fill-opacity="0.7"/>`;
    }
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    s += `<line x1="${cx - 20}" y1="${y(m).toFixed(1)}" x2="${cx + 20}" y2="${y(m).toFixed(1)}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<text x="${cx}" y="${B + 16}" text-anchor="middle" font-size="12" font-weight="600" fill="${MUT}">${labels[i]}</text>`;
  });
  return svg(s, cap);
}

function pairedChart(data) {
  const { before, after } = data;
  const all = before.concat(after);
  const y = yScaler(Math.min(...all), Math.max(...all));
  const x0 = L + (R - L) * 0.3, x1 = L + (R - L) * 0.7;
  let s = caption("Each line is one unit, measured twice") + baseline();
  for (let i = 0; i < before.length; i++) {
    const up = after[i] >= before[i];
    s += `<line x1="${x0}" y1="${y(before[i]).toFixed(1)}" x2="${x1}" y2="${y(after[i]).toFixed(1)}" stroke="${up ? GOOD : BAD}" stroke-width="1.3" stroke-opacity="0.45"/>`;
  }
  for (let i = 0; i < before.length; i++) {
    s += `<circle cx="${x0}" cy="${y(before[i]).toFixed(1)}" r="3.5" fill="${MUT}"/>`;
    s += `<circle cx="${x1}" cy="${y(after[i]).toFixed(1)}" r="3.5" fill="${ACC}"/>`;
  }
  s += `<text x="${x0}" y="${B + 16}" text-anchor="middle" font-size="12" font-weight="600" fill="${MUT}">Before</text>`;
  s += `<text x="${x1}" y="${B + 16}" text-anchor="middle" font-size="12" font-weight="600" fill="${MUT}">After</text>`;
  return svg(s, "Before and after, paired");
}

function scatterChart(x, y, cap, fit) {
  const xmin = Math.min(...x), xmax = Math.max(...x);
  const ymin = Math.min(...y), ymax = Math.max(...y);
  const xpad = (xmax - xmin) * 0.08 || 1, ypad = (ymax - ymin) * 0.1 || 1;
  const sx = (v) => L + ((v - (xmin - xpad)) / ((xmax + xpad) - (xmin - xpad))) * (R - L);
  const sy = (v) => B - ((v - (ymin - ypad)) / ((ymax + ypad) - (ymin - ypad))) * (B - T);
  let s = caption(cap) + baseline();
  for (let i = 0; i < x.length; i++) {
    s += `<circle cx="${sx(x[i]).toFixed(1)}" cy="${sy(y[i]).toFixed(1)}" r="4" fill="${ACC}" fill-opacity="0.6"/>`;
  }
  if (fit) {
    const x1 = xmin - xpad, x2 = xmax + xpad;
    s += `<line x1="${sx(x1).toFixed(1)}" y1="${sy(fit.intercept + fit.slope * x1).toFixed(1)}" x2="${sx(x2).toFixed(1)}" y2="${sy(fit.intercept + fit.slope * x2).toFixed(1)}" stroke="${GOOD}" stroke-width="3" stroke-linecap="round"/>`;
  }
  s += `<text x="${L}" y="${B + 16}" font-size="12" fill="${MUT}">low</text>`;
  s += `<text x="${R}" y="${B + 16}" text-anchor="end" font-size="12" fill="${MUT}">high →</text>`;
  return svg(s, cap);
}

function logisticChart(data) {
  const { x, y } = data;
  const fit = logisticRegression(x, y);
  const xmin = Math.min(...x), xmax = Math.max(...x);
  const xpad = (xmax - xmin) * 0.08 || 1;
  const sx = (v) => L + ((v - (xmin - xpad)) / ((xmax + xpad) - (xmin - xpad))) * (R - L);
  const y0 = 150, y1 = 46; // bands for outcome 0 / 1
  const sy = (p) => y0 - p * (y0 - y1);
  let s = caption("Each dot is one patient (yes = top, no = bottom)") + baseline();
  // logistic curve
  let path = "";
  for (let i = 0; i <= 40; i++) {
    const xv = (xmin - xpad) + (i / 40) * ((xmax + xpad) - (xmin - xpad));
    const p = 1 / (1 + Math.exp(-(fit.intercept + fit.slope * xv)));
    path += `${i === 0 ? "M" : "L"}${sx(xv).toFixed(1)} ${sy(p).toFixed(1)} `;
  }
  s += `<path d="${path}" fill="none" stroke="${GOOD}" stroke-width="3" stroke-linecap="round"/>`;
  for (let i = 0; i < x.length; i++) {
    const cy = (y[i] === 1 ? y1 : y0) + jit(14);
    s += `<circle cx="${sx(x[i]).toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="${ACC}" fill-opacity="0.6"/>`;
  }
  s += `<text x="${L - 6}" y="${y1 + 4}" text-anchor="end" font-size="11" fill="${MUT}">yes</text>`;
  s += `<text x="${L - 6}" y="${y0 + 4}" text-anchor="end" font-size="11" fill="${MUT}">no</text>`;
  return svg(s, "Logistic: probability rises with the predictor");
}

function associationChart(table) {
  const [tr, ct] = table; // [recovered, not]
  const propT = tr[0] / (tr[0] + tr[1]);
  const propC = ct[0] / (ct[0] + ct[1]);
  const bars = [
    { p: propT, label: "Treatment", color: GOOD },
    { p: propC, label: "Control", color: ACC },
  ];
  const floor = B, ceil = 40, hgt = floor - ceil;
  const xs = [L + (R - L) * 0.3, L + (R - L) * 0.7];
  let s = caption("Share who recovered, by group") + baseline();
  bars.forEach((bar, i) => {
    const bh = bar.p * hgt;
    const bw = 58, x = xs[i] - bw / 2;
    s += `<rect x="${x}" y="${(floor - bh).toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="8" fill="${bar.color}" fill-opacity="0.85"/>`;
    s += `<text x="${xs[i]}" y="${(floor - bh - 8).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${INK}">${Math.round(bar.p * 100)}%</text>`;
    s += `<text x="${xs[i]}" y="${B + 16}" text-anchor="middle" font-size="12" font-weight="600" fill="${MUT}">${bar.label}</text>`;
  });
  return svg(s, "Recovery rate by group");
}

// pick the right chart for the data the study produced
export function renderChart(data) {
  switch (data.kind) {
    case "paired": return pairedChart(data);
    case "two": return columns(data.groups, ["Group A", "Group B"], "Each dot is one observation");
    case "multi": return columns(data.groups, ["A", "B", "C"], "Each dot is one plot");
    case "regression": {
      const fit = linearRegression(data.x, data.y);
      return scatterChart(data.x, data.y, "Each dot is one student", fit);
    }
    case "logistic": return logisticChart(data);
    case "association": return associationChart(data.table);
    default: return "";
  }
}

// ---------- flask mascot ----------

const MOUTHS = {
  happy: `<path d="M43 76 Q50 83 57 76" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  ok: `<line x1="44" y1="78" x2="56" y2="78" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  sad: `<path d="M43 80 Q50 73 57 80" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  think: `<circle cx="50" cy="78" r="2.2" fill="${INK}"/>`,
};

export function mascot(mood = "think", cls = "") {
  const sleeping = mood === "sleep";
  const liquid = mood === "happy" ? GOOD : mood === "sad" ? BAD : mood === "ok" ? WARN : sleeping ? MUT : ACC;
  const bubbles =
    mood === "happy"
      ? `<circle cx="46" cy="60" r="2" fill="#fff" fill-opacity="0.7"/><circle cx="54" cy="56" r="1.5" fill="#fff" fill-opacity="0.6"/>`
      : "";
  const eyes = sleeping
    ? `<path d="M41 68 Q43.5 70.5 46 68" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
       <path d="M54 68 Q56.5 70.5 59 68" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
    : `<circle cx="43.5" cy="68" r="2.6" fill="${INK}"/><circle cx="56.5" cy="68" r="2.6" fill="${INK}"/>`;
  const zzz = sleeping
    ? `<text x="70" y="40" font-size="10" fill="${MUT}">z</text><text x="76" y="32" font-size="13" fill="${MUT}">z</text>`
    : "";
  const mouth = sleeping
    ? `<circle cx="50" cy="79" r="2.4" fill="none" stroke="${INK}" stroke-width="2"/>`
    : (MOUTHS[mood] || MOUTHS.think);
  return `
  <svg viewBox="0 0 100 100" class="mascot ${cls}" role="img" aria-label="lab flask mascot">
    <path d="M40 36 L40 52 C40 54 39 55 37 57 L30 64 C23 73 26 90 50 90 C74 90 77 73 70 64 L63 57 C61 55 60 54 60 52 L60 36 Z"
          fill="var(--bg2)" stroke="${LINE}" stroke-width="2"/>
    <path d="M30 70 C34 68 38 72 44 70 C50 68 54 72 60 70 C64 69 68 70 70 70 C73 80 66 88 50 88 C34 88 27 80 30 70 Z"
          fill="${liquid}" fill-opacity="0.9"/>
    ${bubbles}
    <ellipse cx="50" cy="35" rx="11" ry="3" fill="var(--bg2)" stroke="${LINE}" stroke-width="2"/>
    <line x1="40" y1="36" x2="40" y2="52" stroke="${LINE}" stroke-width="2"/>
    <line x1="60" y1="36" x2="60" y2="52" stroke="${LINE}" stroke-width="2"/>
    ${eyes}
    <circle cx="38" cy="73" r="3" fill="${BAD}" fill-opacity="0.35"/>
    <circle cx="62" cy="73" r="3" fill="${BAD}" fill-opacity="0.35"/>
    ${mouth}
    ${zzz}
  </svg>`;
}

// ---------- confetti ----------

export function confetti() {
  const colors = ["#7c8cff", "#46d39a", "#f2c14e", "#ff6b6b", "#ff8cc8"];
  for (let i = 0; i < 28; i++) {
    const d = document.createElement("div");
    d.className = "confetti";
    d.style.left = Math.random() * 100 + "vw";
    d.style.background = colors[i % colors.length];
    d.style.animationDelay = Math.random() * 0.25 + "s";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2000);
  }
}
