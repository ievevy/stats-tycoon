// skills.js — Bayesian Knowledge Tracing (Corbett & Anderson, 1995).
// Each concept is a "skill" with a latent P(known) updated after every attempt.
// Persisted to localStorage. Hinted correct answers count as weak evidence so
// mastery can't be inflated by leaning on hints.

// Display names for each skill (the concepts scenarios + quizzes are tagged with).
export const SKILLS = {
  "pvalue": "Reading a p-value",
  "effect-size": "Effect size",
  "significance": "Significance vs importance",
  "irr": "Rater agreement",
  "paired-ttest": "Paired vs independent",
  "independent-ttest": "Two-group t-test",
  "anova": "3+ groups → ANOVA",
  "linear": "Regression (a predictor)",
  "chi-square": "Categorical association",
  "logistic": "Predicting yes/no",
};

// BKT parameters (sensible defaults; real BKT fits these from data).
const P = {
  L0: 0.30, // prior P(known) before any practice
  T: 0.20,  // P(learn) on each opportunity
  S: 0.10,  // P(slip): knew it but answered wrong
  G: 0.30,  // P(guess): didn't know it but answered right (~1/3 for a 3-option MCQ)
};
export const MASTERY = 0.95;

const SKEY = "statsTycoonSkills";
let cache = null;

function load() { try { const r = localStorage.getItem(SKEY); if (r) return JSON.parse(r); } catch (e) {} return {}; }
function save() { try { localStorage.setItem(SKEY, JSON.stringify(cache)); } catch (e) {} }
function get() { if (!cache) cache = load(); return cache; }

export function pKnown(id) { const c = get(); return c[id] !== undefined ? c[id] : P.L0; }
export function started(id) { return get()[id] !== undefined; }
export function mastered(id) { return pKnown(id) >= MASTERY; }

// Update a skill after an attempt. hinted → treat as weak (incorrect) evidence.
export function update(id, correct, opts = {}) {
  const prior = pKnown(id);
  const obs = opts.hinted ? false : correct;
  // condition P(known) on the observation
  let cond;
  if (obs) cond = (prior * (1 - P.S)) / (prior * (1 - P.S) + (1 - prior) * P.G);
  else cond = (prior * P.S) / (prior * P.S + (1 - prior) * (1 - P.G));
  // learning step
  const post = cond + (1 - cond) * P.T;
  get()[id] = post;
  save();
  return { prior, post, masteredNow: post >= MASTERY && prior < MASTERY };
}

export function allSkills() {
  return Object.keys(SKILLS).map((id) => ({
    id, name: SKILLS[id], p: pKnown(id), started: started(id), mastered: mastered(id),
  }));
}
export const totalSkills = () => Object.keys(SKILLS).length;
export const masteredCount = () => Object.keys(SKILLS).filter((id) => mastered(id)).length;
