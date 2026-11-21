// app.js — the game: a career ladder of levels, each a story chapter of studies.
// Flow: Map → Story → (Brief → Classify → Budget → Run → Debrief)×studies → Level results.
// Progress (unlocked ranks + stars) is saved to localStorage.

import {
  twoSampleT, pairedT, oneWayAnova, linearRegression, chiSquare,
  logisticRegression, approxPower, sampleNormal, normCdf,
} from "./stats.js";
import { scenarios, METHOD_LABELS } from "./scenarios.js";
import { renderChart, mascot, confetti } from "./graphics.js";
import { levels, lockedRanks, scoreStudy, starsFor, PASS_MARK } from "./levels.js";
import { energy, spend, grantForLesson, award, msToNext, msToFull, fmtClock, energyPips, MAX_ENERGY } from "./energy.js";
import {
  AVATARS, ITEMS, seasonalNow, collection, setAvatar, avatarEmoji,
  recordStudy, syncProgress, newCount, markSeen, totalItems,
} from "./collection.js";
import { LESSONS } from "./lessons.js";
import { SKILLS, pKnown, update as trackSkill, allSkills, masteredCount, totalSkills } from "./skills.js";
import { touchStreak, recordActivity as recordStreakActivity, streakCount, freezeCount } from "./streak.js";
import { QUESTIONS } from "./questions.js";
import { PROJECTS } from "./pipeline.js";
import { SUGGESTIONS, answer as helperAnswer } from "./helper.js";

// ---------- helpers ----------

const $ = (sel) => document.querySelector(sel);
const app = () => $("#app");
const fmtP = (p) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const starRow = (n) => "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function structOf(c) {
  if (c.groups === "predictor") return "predictor";
  if (c.groups === "three_plus") return "multi";
  return c.paired === "paired" ? "two_paired" : "two_ind";
}

const STRUCTURE_LABELS = {
  two_ind: "Two independent groups",
  two_paired: "Two paired measurements",
  multi: "Three or more groups",
  predictor: "A continuous predictor",
};

function levelScenarios(lvl) {
  return lvl.scenarioIds === "ALL"
    ? scenarios
    : lvl.scenarioIds.map((id) => scenarios.find((s) => s.id === id));
}

// ---------- persistence ----------

const SAVE_KEY = "statsTycoonProgress";

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      // migrate old {unlocked, stars} saves to a passed-set keyed by level id
      if (!p.passed) {
        p.passed = {};
        for (const id of Object.keys(p.stars || {})) p.passed[id] = true;
      }
      if (!p.stars) p.stars = {};
      return p;
    }
  } catch (e) {}
  return { passed: {}, stars: {} };
}
function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch (e) {}
}

// A level is unlocked if it's first, or the previous level has been passed.
const isUnlockedLevel = (i) => i === 0 || !!progress.passed[levels[i - 1].id];
// Career rank = how many non-foundation chapters have been passed.
const careerRankReached = () =>
  levels.filter((l) => !l.isFoundation && progress.passed[l.id]).length;
// Shape the collection expects: { stars, unlocked: <rank number> }.
const synthProgress = () => ({ stars: progress.stars, unlocked: careerRankReached() });

// ---------- run a chosen method on the scenario's data ----------

function runMethod(method, data) {
  switch (method) {
    case "paired_t": {
      if (data.kind === "paired") {
        const r = pairedT(data.after, data.before);
        return { ran: true, p: r.p, summary: `paired t = ${r.t.toFixed(2)}, mean change = ${r.estimate.toFixed(1)}` };
      }
      if (data.kind === "two") {
        const r = pairedT(data.groups[0], data.groups[1]);
        return { ran: true, p: r.p, summary: `paired t = ${r.t.toFixed(2)} — but these groups are not actually paired` };
      }
      return { ran: false, note: "A paired t-test needs two measurements on the same units. This data has none." };
    }
    case "t_test": {
      let a, b;
      if (data.kind === "two" || data.kind === "multi") { a = data.groups[0]; b = data.groups[1]; }
      else if (data.kind === "paired") { a = data.after; b = data.before; }
      else return { ran: false, note: "A t-test needs a continuous outcome in two groups." };
      const r = twoSampleT(a, b);
      return { ran: true, p: r.p, summary: `t = ${r.t.toFixed(2)}, df = ${r.df.toFixed(1)}, difference = ${r.estimate.toFixed(1)}` };
    }
    case "anova": {
      let groups;
      if (data.kind === "multi" || data.kind === "two") groups = data.groups;
      else if (data.kind === "paired") groups = [data.before, data.after];
      else return { ran: false, note: "ANOVA needs a continuous outcome split into groups." };
      const r = oneWayAnova(groups);
      return { ran: true, p: r.p, summary: `F = ${r.F.toFixed(2)}, df = (${r.dfb}, ${r.dfw})` };
    }
    case "linear": {
      let x, y;
      if (data.kind === "regression") { x = data.x; y = data.y; }
      else if (data.kind === "logistic") { x = data.x; y = data.y; }
      else return { ran: false, note: "Linear regression needs a continuous predictor and continuous outcome." };
      const r = linearRegression(x, y);
      return { ran: true, p: r.p, summary: `slope = ${r.slope.toFixed(2)}, r = ${r.r.toFixed(2)}` };
    }
    case "chi_square": {
      if (data.kind === "association") {
        const r = chiSquare(data.table);
        return { ran: true, p: r.p, summary: `chi² = ${r.chi2.toFixed(2)}, df = ${r.df}` };
      }
      if (data.kind === "logistic") {
        const sorted = [...data.x].sort((p, q) => p - q);
        const med = sorted[Math.floor(sorted.length / 2)];
        const t = [[0, 0], [0, 0]];
        data.x.forEach((xv, i) => {
          const row = xv >= med ? 0 : 1;
          const col = data.y[i] === 1 ? 0 : 1;
          t[row][col]++;
        });
        const r = chiSquare(t);
        return { ran: true, p: r.p, summary: `chi² on a median split = ${r.chi2.toFixed(2)} — throws away the dose scale` };
      }
      return { ran: false, note: "Chi-square needs categorical variables in a contingency table." };
    }
    case "logistic": {
      if (data.kind === "logistic") {
        const r = logisticRegression(data.x, data.y);
        return { ran: true, p: r.p, summary: `log-odds slope = ${r.slope.toFixed(3)}` };
      }
      return { ran: false, note: "Logistic regression needs a binary outcome and a predictor." };
    }
  }
  return { ran: false, note: "Unknown method." };
}

// ---------- game state ----------

let progress;
let state;

function boot() {
  progress = loadProgress();
  syncProgress(synthProgress()); // seed collection from existing progress + this month's seasonal items
  const s = touchStreak();
  state = { step: "map", levelIndex: 0 };
  render();
  if (s.usedFreeze) flashMsg("❄️ Streak freeze used", "freeze");
  else if (s.changed && s.streak > 1) flashMsg(`🔥 ${s.streak}-day streak!`);
}

function startLevel(i) {
  const lvl = levels[i];
  state = {
    step: "story",
    levelIndex: i,
    order: shuffle(levelScenarios(lvl)),
    studyIndex: 0,
    budget: 1000,
    scores: [],
    choice: {},
    result: null,
    promotion: null,
    answered: {},   // quiz answers, keyed by levelId:lessonIndex
    demoState: {},  // interactive-demo state, keyed the same way
  };
  render();
}

const curLevel = () => levels[state.levelIndex];
const current = () => state.order[state.studyIndex];

// ---------- shared UI ----------

function hud() {
  const lvl = curLevel();
  const avg = state.scores.length
    ? Math.round(state.scores.reduce((a, b) => a + b, 0) / state.scores.length)
    : 0;
  return `
    <div class="rankbar"><span><span class="rank-icon">${lvl.icon}</span> ${lvl.rank}</span><span class="epill epill-energy">${energyPips()}</span></div>
    <div class="hud">
      <div class="stat"><span class="label">💰 Budget</span><span class="value">${state.budget}</span></div>
      <div class="stat"><span class="label">📊 Avg score</span><span class="value">${avg}</span></div>
      <div class="stat"><span class="label">🧪 Study</span><span class="value">${state.studyIndex + 1}/${state.order.length}</span></div>
    </div>`;
}

function radioGroup(name, options, chosen) {
  return options
    .map(
      (o) => `
      <label class="opt ${chosen === o.v ? "sel" : ""}">
        <input type="radio" name="${name}" value="${o.v}" ${chosen === o.v ? "checked" : ""}/>
        <span>${o.t}</span>
      </label>`
    )
    .join("");
}

// ---------- screens ----------

// The buildable research campus: one plot per career chapter, built when passed.
function renderSite() {
  const ids = ["foundations", "intern", "ra", "phd", "pi"];
  const builtCount = ids.filter((id) => progress.passed[id]).length;
  const baseY = 158;
  const B = [
    { id: "foundations", x: 12, w: 50, h: 40, light: "#aeb6ff", base: "#8a94ff", roof: "#5b67e0", s: "🧭" },
    { id: "intern", x: 70, w: 56, h: 52, light: "#8ad468", base: "#67c23a", roof: "#4a9e26", s: "🧫" },
    { id: "ra", x: 134, w: 60, h: 66, light: "#ffc266", base: "#f4a62a", roof: "#d4871a", s: "🔬" },
    { id: "phd", x: 202, w: 54, h: 92, light: "#b9a4ff", base: "#9b7cff", roof: "#7658e0", s: "🎓" },
    { id: "pi", x: 262, w: 82, h: 68, light: "#ff9fbd", base: "#ff7aa2", roof: "#e05b86", s: "🏆" },
  ];
  const win = (x, y, roof) => `<g><rect x="${x}" y="${y}" width="13" height="13" rx="2" fill="#fff6cf" stroke="${roof}" stroke-width="1"/><line x1="${x + 6.5}" y1="${y}" x2="${x + 6.5}" y2="${y + 13}" stroke="${roof}" stroke-width="0.8"/><line x1="${x}" y1="${y + 6.5}" x2="${x + 13}" y2="${y + 6.5}" stroke="${roof}" stroke-width="0.8"/></g>`;
  const bld = (b) => {
    const y = baseY - b.h, cx = b.x + b.w / 2;
    if (!progress.passed[b.id]) {
      return `<g opacity="0.5"><ellipse cx="${cx}" cy="${baseY + 2}" rx="${b.w * 0.5}" ry="4" fill="#000" opacity="0.1"/><rect x="${b.x}" y="${y}" width="${b.w}" height="${b.h}" rx="5" fill="none" stroke="#9aa0b8" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${cx}" y="${y + b.h / 2 + 8}" text-anchor="middle" font-size="20">🚧</text></g>`;
    }
    const rows = b.h > 64 ? [y + 13, y + 36] : [y + 13];
    const windows = rows.map((wy) => win(b.x + 8, wy, b.roof) + win(b.x + b.w - 21, wy, b.roof)).join("");
    const flag = b.h > 80 ? `<line x1="${cx}" y1="${y - 18}" x2="${cx}" y2="${y - 30}" stroke="${b.roof}" stroke-width="1.5"/><polygon points="${cx},${y - 30} ${cx + 12},${y - 26} ${cx},${y - 22}" fill="#ff6b6b"/>` : "";
    return `<g>
      <ellipse cx="${cx}" cy="${baseY + 2}" rx="${b.w * 0.55}" ry="4.5" fill="#000" opacity="0.12"/>
      <polygon points="${b.x - 4},${y} ${cx},${y - 18} ${b.x + b.w + 4},${y}" fill="${b.roof}"/>
      <polygon points="${b.x - 4},${y} ${cx},${y - 18} ${cx},${y - 14} ${b.x},${y}" fill="#ffffff" opacity="0.18"/>
      <rect x="${b.x}" y="${y}" width="${b.w}" height="${b.h}" rx="4" fill="url(#fac-${b.id})"/>
      <rect x="${b.x}" y="${baseY - 7}" width="${b.w}" height="7" fill="${b.roof}" opacity="0.25"/>
      ${windows}
      <rect x="${cx - 8}" y="${baseY - 20}" width="16" height="20" rx="2" fill="${b.roof}"/>
      <circle cx="${cx + 4}" cy="${baseY - 10}" r="1.5" fill="#ffd34d"/>
      ${flag}
      <text x="${cx}" y="${y - 23}" text-anchor="middle" font-size="16">${b.s}</text>
    </g>`;
  };
  const tree = (x, s) => `<g transform="translate(${x},${baseY}) scale(${s})"><rect x="-3" y="-18" width="6" height="20" rx="2" fill="#9c6b3f"/><circle cx="0" cy="-26" r="13" fill="#5fae3a"/><circle cx="-10" cy="-20" r="10" fill="#6cc24a"/><circle cx="10" cy="-20" r="10" fill="#6cc24a"/><circle cx="0" cy="-30" r="9" fill="#7ed957"/></g>`;
  const bush = (x) => `<g transform="translate(${x},${baseY})"><circle cx="-6" cy="-5" r="7" fill="#6cc24a"/><circle cx="6" cy="-5" r="7" fill="#5fae3a"/><circle cx="0" cy="-9" r="8" fill="#7ed957"/></g>`;
  const gradDefs = B.map((b) => `<linearGradient id="fac-${b.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.light}"/><stop offset="1" stop-color="${b.base}"/></linearGradient>`).join("");
  const known = [...ITEMS, ...seasonalNow()];
  const props = collection().unlocked.map((id) => { const it = known.find((x) => x.id === id); return it ? it.e : null; }).filter(Boolean).slice(0, 4);
  const propXs = [34, 70, 300, 330];
  const propsSvg = props.map((e, i) => `<text x="${propXs[i]}" y="206" text-anchor="middle" font-size="14">${e}</text>`).join("");
  return `
    <div class="site">
      <svg viewBox="0 0 360 216" class="site-svg" role="img" aria-label="your research campus grows as you progress">
        <defs>
          ${gradDefs}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff"/><stop offset="1" stop-color="#e7f5ff"/></linearGradient>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9edb6e"/><stop offset="1" stop-color="#7fc94f"/></linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="158" fill="url(#sky)"/>
        <circle cx="328" cy="28" r="16" fill="#ffe08a"/><circle cx="328" cy="28" r="11" fill="#ffd34d"/>
        <ellipse cx="66" cy="32" rx="26" ry="10" fill="#fff" opacity="0.85"/><ellipse cx="88" cy="28" rx="16" ry="8" fill="#fff" opacity="0.85"/>
        <ellipse cx="180" cy="20" rx="20" ry="8" fill="#fff" opacity="0.7"/>
        <rect x="0" y="150" width="360" height="66" fill="url(#grass)"/>
        <rect x="0" y="150" width="360" height="3" fill="#8fd05f"/>
        ${tree(24, 1.05)}
        <rect x="0" y="186" width="360" height="20" rx="2" fill="#e7d3a6"/>
        <rect x="0" y="190" width="360" height="12" fill="#efe0bd"/>
        ${bush(116)} ${bush(228)}
        ${B.map(bld).join("")}
        ${tree(344, 0.85)}
        ${propsSvg}
        <ellipse cx="180" cy="208" rx="12" ry="3.5" fill="#000" opacity="0.12"/>
        <text x="180" y="205" text-anchor="middle" font-size="26">${avatarEmoji()}</text>
      </svg>
      <div class="site-stat">🏗️ ${builtCount}/5 built · 🧠 ${masteredCount()}/${totalSkills()} skills mastered</div>
    </div>`;
}

// ----- research-question word-builder -----
const arrEq = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
function loadQuestion(i) {
  const q = QUESTIONS[i];
  state.qb = { i, placed: [], bank: shuffle([...q.tiles, ...(q.distractors || [])]), done: false };
}
function startQBuilder() { loadQuestion(0); state.step = "qbuilder"; render(); }

function renderQbResult(q) {
  const last = state.qb.i + 1 >= QUESTIONS.length;
  return `
    <div class="qb-result">
      <p class="qb-ok"><span class="fb-good">✓ Well-formed question!</span></p>
      <p><strong>Hypotheses</strong><br>H₀: ${q.h0}<br>H₁: ${q.h1}</p>
      <p><strong>Design:</strong> ${q.designLabel} · <strong>outcome:</strong> ${q.outcome}</p>
      <p><strong>Points to:</strong> ${METHOD_LABELS[q.method]}</p>
      <p class="qb-next">${q.explain}</p>
    </div>
    <button class="primary" id="qbNext">${last ? "Done →" : "Next question →"}</button>`;
}

function screenQBuilder() {
  const q = QUESTIONS[state.qb.i];
  const { placed, bank, done } = state.qb;
  return `
    <section class="card">
      <span class="tag">Build a question ${state.qb.i + 1}/${QUESTIONS.length}</span>
      <div class="brief-head">${mascot(done ? "happy" : "think", "sm")}<h2>Research Question</h2></div>
      <p class="prompt">🎯 ${q.goal}</p>
      <div class="qb-answer">${placed.length ? placed.map((t, k) => `<button class="qtile placed" data-i="${k}">${t}</button>`).join("") : '<span class="qb-empty">tap the words below to build your question…</span>'}</div>
      <div class="qb-bank">${bank.map((t, k) => `<button class="qtile" data-b="${k}">${t}</button>`).join("")}</div>
      ${done ? renderQbResult(q) : `<button class="primary" id="qbCheck" ${placed.length ? "" : "disabled"}>Check →</button>`}
      <button class="ghost" id="qbMap">← Career map</button>
    </section>`;
}

// ----- full research-project pipeline -----
const PIPE_STEPS = ["Question", "Hypotheses", "Power", "Method", "Run", "Conclusion"];
const curProj = () => PROJECTS[state.pp.i];
function startPipeline(i = 0) {
  const p = PROJECTS[i];
  state.pp = { i, stage: "build", placed: [], bank: shuffle([...p.tiles, ...p.distractors]), n: 30, method: null };
  state.step = "pipeline";
  render();
}
function screenPipeList() {
  return `
    <section class="card">
      <span class="tag">Full study</span>
      <div class="brief-head">${mascot("happy", "sm")}<h2>Run a Full Study</h2></div>
      <p class="hint">Take a research question all the way from idea to an honest conclusion. Pick a project:</p>
      <div class="proj-list">${PROJECTS.map((p, i) => `<button class="proj-item" data-i="${i}"><span class="proj-title">${p.title}</span><span class="proj-sub">${METHOD_LABELS[p.method]}</span></button>`).join("")}</div>
      <button class="ghost" id="plMap">← Career map</button>
    </section>`;
}
function pipeStepper(active) {
  return `<div class="stepper">${PIPE_STEPS.map((s, i) => `<span class="pstep ${i === active ? "on" : i < active ? "done" : ""}">${i < active ? "✓" : i + 1}</span>`).join("")}</div>`;
}

function screenPipeline() {
  const p = curProj();
  const st = state.pp.stage;
  const idx = { build: 0, hyp: 1, power: 2, method: 3, run: 4, conclude: 5, done: 5 }[st];
  let body = "";

  if (st === "build") {
    const { placed, bank } = state.pp;
    body = `
      <div class="brief-head">${mascot("think", "sm")}<h2>Build the question</h2></div>
      <p class="prompt">🎯 ${p.goal}</p>
      <div class="qb-answer">${placed.length ? placed.map((t, k) => `<button class="qtile placed" data-i="${k}">${t}</button>`).join("") : '<span class="qb-empty">tap the words below…</span>'}</div>
      <div class="qb-bank">${bank.map((t, k) => `<button class="qtile" data-b="${k}">${t}</button>`).join("")}</div>
      <button class="primary" id="ppCheck" ${placed.length ? "" : "disabled"}>Check →</button>`;
  } else if (st === "hyp") {
    body = `
      <h2>Your hypotheses</h2>
      <div class="qb-result"><p><strong>H₀:</strong> ${p.h0}</p><p><strong>H₁:</strong> ${p.h1}</p><p><strong>Design:</strong> ${p.designLabel} · <strong>outcome:</strong> ${p.outcome}</p></div>
      <button class="primary" id="ppNext">Plan the sample →</button>`;
  } else if (st === "power") {
    const power = approxPower(p.effect, state.pp.n, p.powerModel);
    const pct = Math.round(power * 100);
    const cls = power >= 0.8 ? "good" : power >= 0.5 ? "warn" : "bad";
    body = `
      <h2>How big a sample?</h2>
      <p class="hint">You need enough participants to detect the effect if it's real. Aim for power ≥ 80%.</p>
      <div class="slider-wrap"><input type="range" id="ppSlider" min="5" max="120" step="5" value="${state.pp.n}"/>
        <div class="slider-row"><span>Sample size per group</span><span class="big" id="ppN">${state.pp.n}</span></div></div>
      <div class="meter"><div class="meter-label"><span>Approx. power</span><span class="${cls}" id="ppPowV">${pct}%</span></div>
        <div class="bar"><div class="fill ${cls}" id="ppPowBar" style="width:${pct}%"></div></div></div>
      <button class="primary" id="ppNext">Choose a method →</button>`;
  } else if (st === "method") {
    const chosen = state.pp.method;
    body = `
      <h2>Which method?</h2>
      <p class="hint">Pick the test this design calls for.</p>
      <div class="methods">${Object.keys(METHOD_LABELS).map((m) => `<button class="method ${chosen === m ? "sel" : ""}" data-m="${m}">${METHOD_LABELS[m]}</button>`).join("")}</div>
      <button class="primary" id="ppRun" ${chosen ? "" : "disabled"}>Run the study →</button>`;
  } else if (st === "run") {
    const r = state.pp.res;
    body = `
      <h2>Results</h2>
      <div class="chartbox">${renderChart(state.pp.data)}</div>
      <p class="line">You ran: <strong>${METHOD_LABELS[state.pp.method]}</strong> ${state.pp.correctMethod ? '<span class="chip good">right method</span>' : '<span class="chip bad">wrong method</span>'}</p>
      <p class="result">${r.ran ? `Result: <strong>${r.summary}</strong>, p = <strong>${fmtP(r.p)}</strong> ${state.pp.sig ? "(significant)" : "(not significant)"}.` : `<span class="bad-text">${r.note}</span>`}</p>
      <p class="truth"><strong>The truth:</strong> ${p.truth}</p>
      <button class="primary" id="ppNext">Draw your conclusion →</button>`;
  } else if (st === "conclude") {
    const opts = state.pp.sig ? p.sigConclusions : p.nsConclusions;
    if (state.pp.concluded) {
      const correct = opts.find((o) => o.ok);
      body = `
        <h2>What can you conclude?</h2>
        <div class="quiz"><p class="qb-ok"><span class="fb-good">✓ Honest conclusion</span></p><p>"${correct.t}"</p><p class="qb-next">${correct.why}</p></div>
        <div class="caveats"><div class="cav-head">⚠️ Limits of this finding — always state these</div><ul>${p.caveats.map((c) => `<li>${c}</li>`).join("")}</ul></div>
        <button class="primary" id="ppFinish">Finish the study →</button>`;
    } else {
      body = `
        <h2>What can you conclude?</h2>
        <p class="hint">Your result was <strong>${state.pp.sig ? "significant" : "not significant"}</strong>. Pick the honest conclusion — don't over-reach.</p>
        <div class="quiz"><div class="quiz-opts">${opts.map((o, k) => `<button class="quiz-opt" data-c="${k}">${o.t}</button>`).join("")}</div><div class="quiz-fb" id="ppFb"></div></div>`;
    }
  } else if (st === "done") {
    body = `
      <div class="mascot-stage">${mascot("happy", "bob")}</div>
      <h1>Study complete! 🎓</h1>
      <p class="hint">You took a research question all the way from idea to an honest conclusion — the whole pipeline.</p>
      <div class="qb-result"><p><strong>Question:</strong> ${p.tiles.join(" ")}</p><p><strong>Method:</strong> ${METHOD_LABELS[p.method]}</p><p><strong>Outcome:</strong> ${state.pp.sig ? "significant result" : "not significant"} · conclusion drawn correctly</p></div>
      <button class="primary" id="ppDone">Back to map →</button>`;
  }

  return `
    <section class="card${st === "done" ? " center" : ""}">
      <span class="tag">Full study</span>
      ${st === "done" ? "" : pipeStepper(idx)}
      ${body}
      ${st === "done" ? "" : '<button class="ghost" id="ppMap">← Career map</button>'}
    </section>`;
}

// ----- built-in Q&A assistant -----
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function askHelper(q) {
  if (!q || !q.trim()) return;
  if (!state.chat) state.chat = [];
  state.chat.push({ q: q.trim(), a: helperAnswer(q) });
  render();
}
function screenHelper() {
  const chat = state.chat || [];
  const log = chat.length
    ? chat.map((m) => `<div class="bubble q">${esc(m.q)}</div><div class="bubble a">${m.a}</div>`).join("")
    : '<div class="bubble a">Hi! I\'m the Lab Assistant. Ask me about p-values, which test to use, power, effect size, causation… or tap a question below.</div>';
  return `
    <section class="card">
      <span class="tag">Lab Assistant</span>
      <div class="brief-head">${mascot("happy", "sm")}<h2>Ask me anything</h2></div>
      <p class="hint">A built-in helper that answers from the lessons — works offline, no account needed.</p>
      <div class="chat">${log}</div>
      <div class="chips">${SUGGESTIONS.map((s) => `<button class="chip-btn" data-q="${s}">${s}</button>`).join("")}</div>
      <div class="chat-input"><input type="text" id="chatIn" placeholder="Type your question…" autocomplete="off"/><button class="primary chat-send" id="chatSend">Ask</button></div>
      <button class="ghost" id="helperMap">← Career map</button>
    </section>`;
}

function screenMap() {
  const nodes = levels
    .map((lvl, i) => {
      const status = progress.passed[lvl.id] ? "done" : isUnlockedLevel(i) ? "current" : "locked";
      const stars = progress.stars[lvl.id] || 0;
      const starHtml = status === "done" && !lvl.isFoundation ? `<span class="node-stars">${starRow(stars)}</span>` : "";
      const badge = status === "locked" ? "🔒" : status === "done" ? "✓" : lvl.isFoundation ? "📖" : "▶";
      return `
        <button class="node ${status}" data-i="${i}" ${status === "locked" ? "disabled" : ""}>
          <span class="node-icon">${lvl.icon}</span>
          <span class="node-text"><span class="node-chapter">${lvl.chapter}</span><span class="node-rank">${lvl.rank}</span>${starHtml}</span>
          <span class="node-badge">${badge}</span>
        </button>`;
    })
    .join('<div class="node-link"></div>');

  const locked = lockedRanks
    .map(
      (r) => `
      <div class="node locked soon">
        <span class="node-icon">${r.icon}</span>
        <span class="node-text"><span class="node-rank">${r.rank}</span><span class="node-note">${r.note}</span></span>
        <span class="node-badge">🔒</span>
      </div>`
    )
    .join('<div class="node-link"></div>');

  return `
    ${renderSite()}
    <section class="card center">
      <div class="mascot-stage">${mascot("happy", "bob")}</div>
      <h1>Your career</h1>
      <div class="streak-row">
        <span class="epill">🔥 ${streakCount()} day${streakCount() === 1 ? "" : "s"}</span>
        <span class="epill">❄️ ${freezeCount()} freeze${freezeCount() === 1 ? "" : "s"}</span>
      </div>
      <div class="epill big-epill epill-energy">${energyPips()} <span class="epill-label">lab energy</span></div>
      <button class="lab-btn" id="openLab">
        <span class="lab-av">${avatarEmoji()}</span>
        <span>My Lab</span>
        <span class="lab-count">${collection().unlocked.filter((id) => ITEMS.some((i) => i.id === id)).length}/${totalItems()}</span>
        ${newCount() ? '<span class="new-badge">NEW</span>' : ""}
      </button>
      <button class="lab-btn" id="openQB">🧩 Build a Research Question</button>
      <button class="lab-btn" id="openPipe">🔬 Run a Full Study</button>
      <button class="lab-btn" id="openHelper">💬 Ask the Lab Assistant</button>
      <p class="hint">Climb the research ladder. <strong>Lessons give you ⚡ energy; each study you run costs ⚡1.</strong> Tap a glowing rank to play it.</p>
    </section>
    <div class="map">
      ${nodes}
      <div class="node-link"></div>
      ${locked}
    </div>`;
}

function screenStory() {
  const lvl = curLevel();
  return `
    <section class="card">
      <div class="rankbar"><span class="rank-icon">${lvl.icon}</span><span>${lvl.rank}</span></div>
      <span class="tag">${lvl.chapter}</span>
      <div class="brief-head">${mascot("think", "sm")}<h2>${lvl.rank}</h2></div>
      <p class="story">${lvl.story}</p>
      <p class="datanote"><strong>This chapter:</strong> ${lvl.teaches}</p>
      <button class="primary" id="begin">${lvl.isFoundation ? "Start the lessons →" : `Begin — ${state.order.length} studies →`}</button>
      <button class="ghost" id="backMap">← Career map</button>
    </section>`;
}

// ----- interactive lesson blocks -----

function renderQuiz(quiz) {
  return `
    <div class="quiz">
      <p class="quiz-q">🧠 ${quiz.q}</p>
      <div class="quiz-opts">
        ${quiz.options.map((o, idx) => `<button class="quiz-opt" data-idx="${idx}">${o.t}</button>`).join("")}
      </div>
      <div class="quiz-fb" id="quizfb"></div>
    </div>`;
}

function renderVideo(v) {
  return `
    <div class="video">
      <div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}" title="${v.title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>
      <a class="video-cap" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">▶ ${v.title} — ${v.by}</a>
    </div>`;
}

function renderDemo(kind) {
  if (kind === "pvalue") {
    return `
      <div class="demo">
        <div class="demo-title">🎲 Test the theory</div>
        <button class="demo-btn" id="pvRun">Run an experiment (no real effect)</button>
        <div class="demo-out" id="pvOut">Two groups drawn from the <em>same</em> population — any "difference" is pure chance.</div>
        <div class="demo-tally" id="pvTally"></div>
      </div>`;
  }
  if (kind === "effect") {
    return `
      <div class="demo">
        <div class="demo-title">🔬 Drag to explore</div>
        <div id="dArt"></div>
        <input type="range" id="dSlide" min="0" max="120" value="50"/>
        <div class="slider-row"><span>Effect size (Cohen's d)</span><span class="big" id="dVal">0.50</span></div>
        <div class="demo-out" id="dLabel"></div>
      </div>`;
  }
  return "";
}

function wireQuiz(quiz, key) {
  const opts = [...app().querySelectorAll(".quiz-opt")];
  const show = (idx) => {
    opts.forEach((b, j) => {
      b.disabled = true;
      if (quiz.options[j].ok) b.classList.add("correct");
      if (j === idx && !quiz.options[j].ok) b.classList.add("wrong");
    });
    const o = quiz.options[idx];
    const fb = $("#quizfb");
    if (fb) fb.innerHTML = `<span class="${o.ok ? "fb-good" : "fb-bad"}">${o.ok ? "✓ Correct" : "✗ Not quite"}</span> ${o.why}`;
    const nx = $("#lessonNext");
    if (nx) nx.disabled = false;
  };
  if (state.answered[key] !== undefined) show(state.answered[key]);
  else opts.forEach((b) => (b.onclick = () => {
    const idx = +b.dataset.idx;
    state.answered[key] = idx;
    if (quiz.skill) trackSkill(quiz.skill, !!quiz.options[idx].ok);
    show(idx);
  }));
}

function wireDemo(kind, key) {
  if (kind === "pvalue") {
    const d = state.demoState[key] || (state.demoState[key] = { runs: 0, fp: 0 });
    const tally = () => {
      const el = $("#pvTally");
      if (el) el.innerHTML = d.runs ? `Runs: <strong>${d.runs}</strong> · false alarms: <strong>${d.fp}</strong> (${Math.round((d.fp / d.runs) * 100)}%) — long-run, this hovers near 5%.` : "";
    };
    tally();
    const btn = $("#pvRun");
    if (btn) btn.onclick = () => {
      const a = sampleNormal(25, 100, 15), b = sampleNormal(25, 100, 15);
      const r = twoSampleT(a, b);
      const sig = r.p < 0.05;
      d.runs++; if (sig) d.fp++;
      const out = $("#pvOut");
      if (out) out.innerHTML = `p = <strong>${fmtP(r.p)}</strong> → ${sig ? '<span class="fb-bad">"significant"! but it\'s a FALSE ALARM — there is no real effect</span>' : '<span class="fb-good">not significant ✓</span>'}`;
      tally();
    };
  }
  if (kind === "effect") {
    const st = state.demoState[key] || (state.demoState[key] = { d: 0.5 });
    const bell = (cx, color) => `<path d="M${cx - 80} 108 C${cx - 40} 108 ${cx - 28} 24 ${cx} 24 C${cx + 28} 24 ${cx + 40} 108 ${cx + 80} 108" fill="none" stroke="${color}" stroke-width="2.5"/>`;
    const draw = () => {
      const dv = st.d;
      const sep = dv * 80;
      const art = $("#dArt");
      if (art) art.innerHTML = `<svg viewBox="0 0 280 120" class="lesson-art" role="img" aria-label="two curves separated by d">${bell(140 - sep / 2, "var(--muted)")}${bell(140 + sep / 2, "var(--cta)")}</svg>`;
      const v = $("#dVal"); if (v) v.textContent = dv.toFixed(2);
      const size = dv < 0.35 ? "small" : dv < 0.65 ? "medium" : "large";
      const overlap = Math.round(2 * normCdf(-dv / 2) * 100);
      const lab = $("#dLabel"); if (lab) lab.innerHTML = `A <strong>${size}</strong> effect — the groups overlap about <strong>${overlap}%</strong>.`;
    };
    const sl = $("#dSlide");
    if (sl) { sl.value = Math.round(st.d * 100); sl.oninput = () => { st.d = (+sl.value) / 100; draw(); }; }
    draw();
  }
}

function screenLesson() {
  const lvl = curLevel();
  const lessons = LESSONS[lvl.id] || [];
  const i = state.lessonIndex;
  const lesson = lessons[i] || { title: "", body: "" };
  const dots = lessons.map((_, k) => `<span class="dot ${k === i ? "on" : ""}"></span>`).join("");
  const last = i === lessons.length - 1;
  const nextLabel = last
    ? (lvl.isFoundation ? "Finish orientation →" : "Start the studies →")
    : "Next →";
  const key = lvl.id + ":" + i;
  const locked = lesson.quiz && state.answered[key] === undefined;
  return `
    <section class="card">
      <div class="rankbar"><span><span class="rank-icon">${lvl.icon}</span> ${lvl.rank}</span><span class="epill epill-energy">${energyPips()}</span></div>
      <span class="tag">Lesson ${i + 1}/${lessons.length}</span>
      <h2>${lesson.title}</h2>
      ${lesson.video ? renderVideo(lesson.video) : ""}
      ${lesson.art ? `<div class="chartbox lesson-box">${lesson.art}</div>` : ""}
      <div class="lesson-body">${lesson.body}</div>
      ${lesson.demo ? renderDemo(lesson.demo) : ""}
      ${lesson.quiz ? renderQuiz(lesson.quiz) : ""}
      ${lesson.source ? `<p class="source">Source: ${lesson.source}</p>` : ""}
      <div class="dots">${dots}</div>
      <button class="primary" id="lessonNext" ${locked ? "disabled" : ""}>${nextLabel}</button>
      <button class="ghost" id="lessonBack">${i > 0 ? "← Previous" : "← Back"}</button>
    </section>`;
}

function finishFoundation() {
  const lvl = curLevel();
  const firstTime = !progress.passed[lvl.id];
  progress.passed[lvl.id] = true;
  saveProgress();
  const unlocks = syncProgress(synthProgress());
  const next = firstTime ? levels[state.levelIndex + 1] : null;
  state.levelResult = { foundation: true, passed: true, promotion: next, unlocks, stars: 0, avg: null };
  state.step = "levelend";
  render();
}

function screenBrief() {
  const sc = current();
  return hud() + `
    <section class="card">
      <span class="tag">Brief</span>
      <div class="brief-head">${mascot("think", "sm")}<h2>${sc.title}</h2></div>
      <p class="prompt">${sc.prompt}</p>
      <p class="datanote"><strong>Your data:</strong> ${sc.dataNote}</p>
      <button class="primary" id="toClassify">Classify the problem →</button>
    </section>`;
}

function screenClassify() {
  const c = state.choice;
  return hud() + `
    <section class="card">
      <span class="tag">Classify</span>
      <h2>What are you looking at?</h2>
      <p class="qlabel">Outcome variable</p>
      <div class="opts">${radioGroup("outcome", [
        { v: "continuous", t: "Continuous (a number)" },
        { v: "binary", t: "Binary (yes / no)" },
        { v: "count", t: "Count (events)" },
        { v: "categorical", t: "Categorical, 3+ classes" },
      ], c.outcome)}</div>
      <p class="qlabel">Structure of the comparison</p>
      <div class="opts">${radioGroup("structure", [
        { v: "two_ind", t: STRUCTURE_LABELS.two_ind },
        { v: "two_paired", t: STRUCTURE_LABELS.two_paired },
        { v: "multi", t: STRUCTURE_LABELS.multi },
        { v: "predictor", t: STRUCTURE_LABELS.predictor },
      ], c.structure)}</div>
      <button class="primary" id="toBudget" ${c.outcome && c.structure ? "" : "disabled"}>Plan the sample →</button>
    </section>`;
}

function screenBudget() {
  const sc = current();
  const n = state.choice.n || 30;
  const power = approxPower(sc.effect, n, sc.powerModel);
  const cost = n * 8;
  const pct = Math.round(power * 100);
  const powClass = power >= 0.8 ? "good" : power >= 0.5 ? "warn" : "bad";
  return hud() + `
    <section class="card">
      <span class="tag">Budget</span>
      <h2>How big a sample?</h2>
      <p class="hint">Bigger samples cost more but make a real effect easier to detect. Aim for power ≥ 80%.</p>
      <div class="slider-wrap">
        <input type="range" id="nSlider" min="5" max="120" step="5" value="${n}"/>
        <div class="slider-row"><span>Sample size (n)</span><span class="big" id="nVal">${n}</span></div>
      </div>
      <div class="meter">
        <div class="meter-label"><span>Approx. power</span><span class="${powClass}" id="powVal">${pct}%</span></div>
        <div class="bar"><div class="fill ${powClass}" id="powBar" style="width:${pct}%"></div></div>
      </div>
      <p class="cost">Cost of this study: <strong id="costVal">${cost}</strong> credits</p>
      <button class="primary" id="toMethod">Choose a method →</button>
    </section>`;
}

function renderHints(sc, hl) {
  const shown = (sc.hints || []).slice(0, hl);
  return `
    <div class="hints">
      <div class="hint-head">${mascot("think", "xs")}<span>Lab assistant</span></div>
      ${shown.map((h) => `<p class="hint-line">💡 ${h}</p>`).join("")}
      ${hl < (sc.hints || []).length ? `<button class="hint-btn" id="hintMore">Another hint →</button>` : ""}
    </div>`;
}

function screenMethod() {
  const methods = Object.keys(METHOD_LABELS);
  const chosen = state.choice.method;
  const sc = current();
  const hl = state.choice.hintLevel || 0;
  const stuck = pKnown(sc.skill) < 0.4;
  return hud() + `
    <section class="card">
      <span class="tag">Run</span>
      <h2>Which method?</h2>
      <p class="hint">Pick the one the decision tree points to for this design.</p>
      <div class="methods">
        ${methods.map((m) => `<button class="method ${chosen === m ? "sel" : ""}" data-m="${m}">${METHOD_LABELS[m]}</button>`).join("")}
      </div>
      <div class="hintbox">${hl > 0 ? renderHints(sc, hl) : `<button class="hint-btn" id="hintBtn">🧪 ${stuck ? "Stuck? Ask the lab assistant" : "Need a hint?"}</button>`}</div>
      <button class="primary" id="runStudy" ${chosen ? "" : "disabled"}>Run the study →</button>
    </section>`;
}

function grade() {
  const sc = current();
  const n = state.choice.n || 30;
  const data = sc.simulate(n);
  const res = runMethod(state.choice.method, data);
  const power = approxPower(sc.effect, n, sc.powerModel);
  const powered = power >= 0.8;
  const correctMethod = state.choice.method === sc.method;
  const correctClassify =
    state.choice.outcome === sc.classify.outcome &&
    state.choice.structure === structOf(sc.classify);
  const sig = res.ran && res.p < 0.05;
  const score = scoreStudy({ correctMethod, correctClassify, sig, powered, effectReal: sc.effectReal });

  let verdict, tone;
  if (correctMethod) {
    if (sig && sc.effectReal) { verdict = "Correct method, and you detected the real effect. A finding you can trust."; tone = "good"; }
    else if (!sig && sc.effectReal) {
      verdict = powered
        ? "Right method, but unlucky — the effect is real and usually detectable at this sample size."
        : "Right method, but UNDERPOWERED. The sample was too small, so a real effect slipped through.";
      tone = "warn";
    } else { verdict = "Correct method; no real effect to find, and you didn't invent one. Clean work."; tone = "good"; }
  } else {
    verdict = res.ran
      ? "Wrong method for this design. It still prints a p-value — which is exactly the trap. The number is misleading."
      : "Wrong method for this design — it doesn't even apply to this data.";
    tone = "bad";
  }

  const cost = n * 8;
  const grant = Math.round(score * 6);
  state.budget = state.budget - cost + grant;
  state.scores.push(score);
  const unlocks = recordStudy(correctMethod, score);
  const mastery = trackSkill(sc.skill, correctMethod, { hinted: !!state.choice.hinted });
  const streakAct = recordStreakActivity();
  state.result = { sc, res, data, power, powered, correctMethod, correctClassify, sig, verdict, tone, score, grant, cost, n, unlocks, skill: sc.skill, mastery, hinted: !!state.choice.hinted, freezeEarned: streakAct.earnedFreeze };
}

function screenDebrief() {
  const r = state.result;
  const sc = r.sc;
  const resultLine = r.res.ran
    ? `<p class="result">Result: <strong>${r.res.summary}</strong>, p = <strong>${fmtP(r.res.p)}</strong> ${r.sig ? "(significant)" : "(not significant)"}.</p>`
    : `<p class="result bad-text">${r.res.note}</p>`;
  const mood = r.tone === "good" ? "happy" : r.tone === "warn" ? "ok" : "sad";
  return hud() + `
    <section class="card debrief ${r.tone}">
      <span class="tag">Debrief</span>
      <div class="brief-head">${mascot(mood, "sm")}<h2>${sc.title}</h2></div>
      <div class="chartbox">${renderChart(r.data)}</div>
      <p class="line"><strong>You chose:</strong> ${METHOD_LABELS[state.choice.method]} ${r.correctMethod ? '<span class="chip good">right method</span>' : '<span class="chip bad">wrong method</span>'} ${r.correctClassify ? '<span class="chip good">classified right</span>' : '<span class="chip warn">misclassified</span>'}</p>
      ${resultLine}
      <p class="truth"><strong>The truth:</strong> ${sc.truthText}</p>
      <p class="verdict">${r.verdict}</p>
      <p class="teach">${sc.teach}</p>
      <div class="scoreline">
        <span>n=${r.n} · power ${Math.round(r.power * 100)}%${r.hinted ? " · hint used" : ""}</span>
        <span class="study-score">+${r.score} score</span>
      </div>
      ${r.mastery ? `<p class="mastery-line">${SKILLS[r.skill]}: ${Math.round(r.mastery.prior * 100)}% → <strong>${Math.round(r.mastery.post * 100)}%</strong> mastery${r.mastery.masteredNow ? ' <span class="fb-good">🎉 mastered!</span>' : ""}</p>` : ""}
      ${unlockBanner(r.unlocks)}
      <button class="primary" id="next">${state.studyIndex + 1 < state.order.length ? "Next study →" : "Finish chapter →"}</button>
    </section>`;
}

function finishLevel() {
  const avg = Math.round(state.scores.reduce((a, b) => a + b, 0) / state.scores.length);
  const stars = starsFor(avg);
  const passed = avg >= PASS_MARK;
  const lvl = curLevel();
  let promotion = null;

  if (passed) {
    if ((progress.stars[lvl.id] || 0) < stars) progress.stars[lvl.id] = stars;
    const firstTime = !progress.passed[lvl.id];
    progress.passed[lvl.id] = true;
    saveProgress();
    if (firstTime) {
      const next = levels[state.levelIndex + 1];
      if (next) promotion = next;
    }
  }
  const unlocks = syncProgress(synthProgress());
  state.levelResult = { avg, stars, passed, promotion, unlocks };
  state.step = "levelend";
  render();
}

function screenLevelEnd() {
  const { avg, stars, passed, promotion, foundation } = state.levelResult;
  const lvl = curLevel();
  const mood = passed ? "happy" : "sad";

  if (foundation) {
    return `
      <section class="card center">
        <div class="mascot-stage">${mascot("happy", "bob")}</div>
        <span class="tag">Orientation</span>
        <h1>Foundations complete!</h1>
        <p class="hint">You've got the basics — p-values, effect size, and rater agreement. Now put them to work.</p>
        ${unlockBanner(state.levelResult.unlocks)}
        ${promotion ? `<div class="promo"><span class="promo-icon">${promotion.icon}</span><p>Unlocked <strong>${promotion.rank}</strong>!</p></div>` : ""}
        <button class="primary" id="toMap">Career map →</button>
      </section>`;
  }

  const headline = passed ? "Chapter passed!" : "Not quite yet";
  let promoHtml = "";
  if (promotion) {
    promoHtml = `<div class="promo"><span class="promo-icon">${promotion.icon}</span><p>Promoted to <strong>${promotion.rank}</strong>!</p></div>`;
  } else if (passed && state.levelIndex === levels.length - 1) {
    promoHtml = `<div class="promo"><span class="promo-icon">🥇</span><p>You've topped the ladder — <strong>Principal Investigator</strong>. New ranks coming soon.</p></div>`;
  }
  const failHtml = passed ? "" : `<p class="hint">You need an average of ${PASS_MARK} to pass. Re-read the debriefs and try the chapter again.</p>`;
  return `
    <section class="card center">
      <div class="mascot-stage">${mascot(mood, "bob")}</div>
      <span class="tag">${lvl.chapter}</span>
      <h1>${headline}</h1>
      <div class="bigstars">${starRow(stars)}</div>
      <p class="grade">Average score: ${avg}</p>
      ${unlockBanner(state.levelResult.unlocks)}
      ${promoHtml}
      ${failHtml}
      <button class="primary" id="toMap">Career map →</button>
      ${passed ? "" : '<button class="ghost" id="retry">Retry chapter</button>'}
    </section>`;
}

function unlockBanner(unlocks) {
  if (!unlocks || !unlocks.length) return "";
  const items = unlocks.map((u) => `<span class="unlock-item">${u.e} ${u.name}</span>`).join("");
  return `<div class="unlock-toast">✨ New lab item${unlocks.length > 1 ? "s" : ""}! ${items}</div>`;
}

function screenLab() {
  markSeen();
  const c = collection();
  const avatars = AVATARS.map(
    (a) => `<button class="avatar-opt ${c.avatar === a.id ? "sel" : ""}" data-a="${a.id}"><span class="av-e">${a.e}</span><span class="av-n">${a.name}</span></button>`
  ).join("");

  const season = seasonalNow();
  const known = [...ITEMS, ...season];
  const shelf = c.unlocked
    .map((id) => { const it = known.find((x) => x.id === id); return it ? `<span class="shelf-item" title="${it.name}">${it.e}</span>` : ""; })
    .join("");

  const grid = ITEMS.map((it) => {
    const un = c.unlocked.includes(it.id);
    return `<div class="slot ${un ? "un" : "lock"}"><span class="slot-e">${un ? it.e : "🔒"}</span><span class="slot-n">${un ? it.name : it.hint}</span></div>`;
  }).join("");

  const earned = c.unlocked.filter((id) => ITEMS.some((i) => i.id === id)).length;

  const seasonHtml = season.length
    ? `<p class="qlabel">Seasonal — this month</p>
       <div class="collection">${season.map((it) => {
          const un = c.unlocked.includes(it.id);
          return `<div class="slot season ${un ? "un" : "lock"}"><span class="slot-e">${un ? it.e : "❓"}</span><span class="slot-n">${it.name}</span></div>`;
        }).join("")}</div>`
    : "";

  return `
    <section class="card">
      <span class="tag">My Lab</span>
      <div class="lab-scene">
        <span class="lab-avatar">${avatarEmoji()}</span>
        <div class="shelf">${shelf || '<span class="shelf-empty">Earn items by getting methods right →</span>'}</div>
      </div>
      <p class="qlabel">Choose your avatar</p>
      <div class="avatars">${avatars}</div>
      <p class="qlabel">Skill mastery — ${masteredCount()}/${totalSkills()}</p>
      <div class="skills">
        ${allSkills().map((s) => {
          const pct = Math.round(s.p * 100);
          return `<div class="skill-row"><div class="skill-top"><span>${s.name}</span><span class="${s.mastered ? "fb-good" : ""}">${s.started ? pct + "%" : "—"}</span></div><div class="bar"><div class="fill ${s.mastered ? "good" : "warn"}" style="width:${s.started ? pct : 0}%"></div></div></div>`;
        }).join("")}
      </div>
      <p class="qlabel">Collection — ${earned}/${totalItems()}</p>
      <div class="collection">${grid}</div>
      ${seasonHtml}
      <button class="ghost" id="labBack">← Career map</button>
    </section>`;
}

// A brief floating toast (energy earned, streak, freeze…).
function flashMsg(text, variant) {
  const el = document.createElement("div");
  el.className = "energy-flash" + (variant ? " " + variant : "");
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
function flashEnergy(amount) { if (amount) flashMsg(`+${amount} ⚡`); }

// Try to run the current study, spending one energy. Blocked → out-of-energy screen.
function doRun() {
  if (spend(1)) {
    grade();
    state.step = "debrief";
    render();
    if (state.result.freezeEarned) flashMsg("❄️ +1 streak freeze", "freeze");
  } else { state.step = "energyout"; render(); }
}

function screenEnergyOut() {
  const e = energy();
  const ready = e >= 1;
  return `
    <section class="card center">
      <div class="mascot-stage">${mascot(ready ? "happy" : "sleep", "bob")}</div>
      <h1>${ready ? "Energy restored!" : "Out of lab energy"}</h1>
      <div class="epill big-epill epill-energy">${energyPips()}</div>
      ${ready
        ? `<p class="hint">Your lab has energy again. Pick up right where you left off.</p>
           <button class="primary" id="resume">Run the study →</button>
           <button class="ghost" id="eout-learn">📖 Learn a lesson to recharge</button>`
        : `<p class="hint">Recharge by learning: a new lesson gives +3 ⚡, and re-reading one tops you up. (It also trickles back slowly on its own.)</p>
           <button class="primary" id="eout-learn">📖 Learn a lesson to recharge →</button>
           <div class="timer">
             <div><span class="timer-label">Or next ⚡ in</span><span class="timer-val" id="energy-next">${fmtClock(msToNext())}</span></div>
             <div><span class="timer-label">Full in</span><span class="timer-val" id="energy-full">${fmtClock(msToFull())}</span></div>
           </div>
           <button class="ghost" id="eout-map">← Career map</button>`}
    </section>`;
}

// ---------- render + events ----------

function render() {
  const screens = {
    map: screenMap, story: screenStory, brief: screenBrief, classify: screenClassify,
    budget: screenBudget, method: screenMethod, debrief: screenDebrief, levelend: screenLevelEnd,
    energyout: screenEnergyOut, lab: screenLab, lesson: screenLesson, qbuilder: screenQBuilder,
    pipeline: screenPipeline, helper: screenHelper, pipelist: screenPipeList,
  };
  app().innerHTML = screens[state.step]();
  wire();
  window.scrollTo(0, 0);
}

function wire() {
  const step = state.step;

  if (step === "map") {
    app().querySelectorAll(".node[data-i]").forEach((btn) => {
      btn.onclick = () => startLevel(+btn.dataset.i);
    });
    const lab = $("#openLab");
    if (lab) lab.onclick = () => { state.step = "lab"; render(); };
    const qb = $("#openQB");
    if (qb) qb.onclick = () => startQBuilder();
    const pipe = $("#openPipe");
    if (pipe) pipe.onclick = () => { state.step = "pipelist"; render(); };
    const hlp = $("#openHelper");
    if (hlp) hlp.onclick = () => { if (!state.chat) state.chat = []; state.step = "helper"; render(); };
  }

  if (step === "helper") {
    const send = () => { const inp = $("#chatIn"); if (inp) askHelper(inp.value); };
    const sb = $("#chatSend"); if (sb) sb.onclick = send;
    const inp = $("#chatIn"); if (inp) inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
    app().querySelectorAll(".chip-btn").forEach((b) => (b.onclick = () => askHelper(b.dataset.q)));
    $("#helperMap").onclick = () => { state.step = "map"; render(); };
    const c = app().querySelector(".chat"); if (c) c.scrollTop = c.scrollHeight;
  }

  if (step === "pipelist") {
    app().querySelectorAll(".proj-item").forEach((b) => (b.onclick = () => startPipeline(+b.dataset.i)));
    $("#plMap").onclick = () => { state.step = "map"; render(); };
  }

  if (step === "pipeline") {
    const p = curProj();
    const st = state.pp.stage;
    if (st === "build") {
      app().querySelectorAll(".qtile.placed").forEach((btn) => { btn.onclick = () => { state.pp.bank.push(state.pp.placed.splice(+btn.dataset.i, 1)[0]); render(); }; });
      app().querySelectorAll(".qb-bank .qtile").forEach((btn) => { btn.onclick = () => { state.pp.placed.push(state.pp.bank.splice(+btn.dataset.b, 1)[0]); render(); }; });
      const chk = $("#ppCheck");
      if (chk) chk.onclick = () => {
        if (arrEq(state.pp.placed, p.tiles)) { state.pp.stage = "hyp"; render(); }
        else flashMsg("Not quite — reorder or swap words", "freeze");
      };
    }
    if (st === "hyp") $("#ppNext").onclick = () => { state.pp.stage = "power"; render(); };
    if (st === "power") {
      const slider = $("#ppSlider");
      slider.oninput = () => {
        const n = +slider.value; state.pp.n = n;
        const pw = approxPower(p.effect, n, p.powerModel); const pct = Math.round(pw * 100);
        const cls = pw >= 0.8 ? "good" : pw >= 0.5 ? "warn" : "bad";
        $("#ppN").textContent = n;
        const v = $("#ppPowV"); v.textContent = pct + "%"; v.className = cls;
        const b = $("#ppPowBar"); b.style.width = pct + "%"; b.className = "fill " + cls;
      };
      $("#ppNext").onclick = () => { state.pp.stage = "method"; render(); };
    }
    if (st === "method") {
      app().querySelectorAll(".method").forEach((btn) => { btn.onclick = () => { state.pp.method = btn.dataset.m; render(); }; });
      const run = $("#ppRun");
      if (run) run.onclick = () => {
        const data = p.simulate(state.pp.n);
        const res = runMethod(state.pp.method, data);
        const sig = res.ran && res.p < 0.05;
        const correctMethod = state.pp.method === p.method;
        Object.assign(state.pp, { data, res, sig, correctMethod, stage: "run" });
        trackSkill(p.skill, correctMethod);
        render();
      };
    }
    if (st === "run") $("#ppNext").onclick = () => { state.pp.stage = "conclude"; render(); };
    if (st === "conclude" && !state.pp.concluded) {
      const opts = state.pp.sig ? p.sigConclusions : p.nsConclusions;
      app().querySelectorAll(".quiz-opt").forEach((btn) => {
        btn.onclick = () => {
          const o = opts[+btn.dataset.c];
          if (o.ok) { state.pp.concluded = true; render(); }
          else { btn.disabled = true; btn.classList.add("wrong"); $("#ppFb").innerHTML = `<span class="fb-bad">✗ Over-reach</span> ${o.why}`; }
        };
      });
    }
    if (st === "conclude" && state.pp.concluded) {
      $("#ppFinish").onclick = () => {
        recordStreakActivity();
        const got = award(3);
        state.pp.stage = "done"; render(); confetti(); flashEnergy(got);
      };
    }
    if (st === "done") $("#ppDone").onclick = () => { state.step = "map"; render(); };
    const map = $("#ppMap");
    if (map) map.onclick = () => { state.step = "map"; render(); };
  }

  if (step === "qbuilder") {
    app().querySelectorAll(".qtile.placed").forEach((btn) => {
      btn.onclick = () => { const k = +btn.dataset.i; state.qb.bank.push(state.qb.placed.splice(k, 1)[0]); render(); };
    });
    app().querySelectorAll(".qb-bank .qtile").forEach((btn) => {
      btn.onclick = () => { const k = +btn.dataset.b; state.qb.placed.push(state.qb.bank.splice(k, 1)[0]); render(); };
    });
    const chk = $("#qbCheck");
    if (chk) chk.onclick = () => {
      const q = QUESTIONS[state.qb.i];
      if (arrEq(state.qb.placed, q.tiles)) {
        state.qb.done = true;
        trackSkill(q.skill, true);
        recordStreakActivity();
        render();
      } else { flashMsg("Not quite — reorder or swap words", "freeze"); }
    };
    const nx = $("#qbNext");
    if (nx) nx.onclick = () => {
      if (state.qb.i + 1 >= QUESTIONS.length) { state.step = "map"; render(); }
      else { loadQuestion(state.qb.i + 1); render(); }
    };
    $("#qbMap").onclick = () => { state.step = "map"; render(); };
  }

  if (step === "lab") {
    app().querySelectorAll(".avatar-opt").forEach((btn) => {
      btn.onclick = () => { setAvatar(btn.dataset.a); render(); };
    });
    $("#labBack").onclick = () => { state.step = "map"; render(); };
  }

  if (step === "story") {
    $("#begin").onclick = () => { state.lessonIndex = 0; state.step = "lesson"; render(); };
    $("#backMap").onclick = () => { state.step = "map"; render(); };
  }

  if (step === "lesson") {
    const lvl = curLevel();
    const lessons = LESSONS[lvl.id] || [];
    const lesson = lessons[state.lessonIndex] || {};
    const key = lvl.id + ":" + state.lessonIndex;
    const back = $("#lessonBack");
    if (back) back.onclick = () => {
      if (state.lessonIndex > 0) { state.lessonIndex--; render(); }
      else { state.step = "story"; render(); }
    };
    $("#lessonNext").onclick = () => {
      const got = grantForLesson(key); // lessons pay energy (first time banks, reviews top up)
      const streakAct = recordStreakActivity();
      if (state.lessonIndex < lessons.length - 1) { state.lessonIndex++; render(); }
      else if (lvl.isFoundation) finishFoundation();
      else { state.choice = {}; state.studyIndex = 0; state.step = "brief"; render(); }
      flashEnergy(got.amount);
      if (streakAct.earnedFreeze) flashMsg("❄️ +1 streak freeze", "freeze");
    };
    if (lesson.demo) wireDemo(lesson.demo, key);
    if (lesson.quiz) wireQuiz(lesson.quiz, key);
  }

  if (step === "brief") $("#toClassify").onclick = () => { state.choice = {}; state.step = "classify"; render(); };

  if (step === "classify") {
    app().querySelectorAll('input[name="outcome"]').forEach((el) => {
      el.onchange = () => { state.choice.outcome = el.value; render(); };
    });
    app().querySelectorAll('input[name="structure"]').forEach((el) => {
      el.onchange = () => { state.choice.structure = el.value; render(); };
    });
    const b = $("#toBudget");
    if (b) b.onclick = () => { state.choice.n = 30; state.step = "budget"; render(); };
  }

  if (step === "budget") {
    const slider = $("#nSlider");
    const sc = current();
    slider.oninput = () => {
      const n = +slider.value;
      state.choice.n = n;
      const power = approxPower(sc.effect, n, sc.powerModel);
      const pct = Math.round(power * 100);
      const cls = power >= 0.8 ? "good" : power >= 0.5 ? "warn" : "bad";
      $("#nVal").textContent = n;
      $("#costVal").textContent = n * 8;
      const pv = $("#powVal"); pv.textContent = pct + "%"; pv.className = cls;
      const pb = $("#powBar"); pb.style.width = pct + "%"; pb.className = "fill " + cls;
    };
    $("#toMethod").onclick = () => { state.step = "method"; render(); };
  }

  if (step === "method") {
    app().querySelectorAll(".method").forEach((btn) => {
      btn.onclick = () => { state.choice.method = btn.dataset.m; render(); };
    });
    const hb = $("#hintBtn");
    if (hb) hb.onclick = () => { state.choice.hintLevel = 1; state.choice.hinted = true; render(); };
    const hm = $("#hintMore");
    if (hm) hm.onclick = () => { state.choice.hintLevel = (state.choice.hintLevel || 1) + 1; render(); };
    const run = $("#runStudy");
    if (run) run.onclick = () => doRun();
  }

  if (step === "energyout") {
    const resume = $("#resume");
    if (resume) resume.onclick = () => doRun();
    const learn = $("#eout-learn");
    if (learn) learn.onclick = () => { state.step = "map"; render(); };
    const emap = $("#eout-map");
    if (emap) emap.onclick = () => { state.step = "map"; render(); };
  }

  if (step === "debrief") {
    if (state.result && state.result.tone === "good") confetti();
    $("#next").onclick = () => {
      state.studyIndex++;
      if (state.studyIndex >= state.order.length) finishLevel();
      else { state.choice = {}; state.step = "brief"; render(); }
    };
  }

  if (step === "levelend") {
    if (state.levelResult.passed) confetti();
    $("#toMap").onclick = () => { state.step = "map"; render(); };
    const retry = $("#retry");
    if (retry) retry.onclick = () => startLevel(state.levelIndex);
  }
}

// ---------- live energy ticker ----------

function tick() {
  const e = energy(); // refreshes regen from the clock
  document.querySelectorAll(".epill-energy").forEach((el) => {
    // keep any trailing label span intact
    const label = el.querySelector(".epill-label");
    el.innerHTML = energyPips() + (label ? ' <span class="epill-label">lab energy</span>' : "");
  });
  if (state.step === "energyout") {
    const nx = $("#energy-next"), fu = $("#energy-full");
    if (nx) nx.textContent = fmtClock(msToNext());
    if (fu) fu.textContent = fmtClock(msToFull());
    // just regenerated the first point → reveal the resume button
    if (e >= 1 && !$("#resume")) render();
  }
}

// ---------- boot ----------

boot();
setInterval(tick, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
