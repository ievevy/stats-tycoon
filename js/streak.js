// streak.js — daily engagement streak with earn-able streak freezes (Duolingo-style).
// A gentle behaviorist layer: show up each day to grow the streak; practice earns
// freezes that cover a missed day. All local, in localStorage.

const SKEY = "statsTycoonStreak";
const FREEZE_CAP = 3;
const PRACTICE_PER_FREEZE = 4; // completed studies/lessons per earned freeze

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dayNum = (s) => Math.floor(Date.parse(s + "T00:00:00") / 86400000);

let cache = null;
function load() { try { const r = localStorage.getItem(SKEY); if (r) return JSON.parse(r); } catch (e) {} return { lastActive: null, streak: 0, freezes: 0, practice: 0 }; }
function save() { try { localStorage.setItem(SKEY, JSON.stringify(cache)); } catch (e) {} }
function get() { if (!cache) cache = load(); return cache; }

// Call on app open. Advances the streak, spending freezes to cover missed days.
export function touchStreak() {
  const c = get();
  const t = today();
  if (!c.lastActive) { c.streak = 1; c.lastActive = t; save(); return { streak: 1, changed: true, usedFreeze: 0 }; }
  if (c.lastActive === t) return { streak: c.streak, changed: false, usedFreeze: 0 };
  const diff = dayNum(t) - dayNum(c.lastActive);
  if (diff === 1) { c.streak += 1; c.lastActive = t; save(); return { streak: c.streak, changed: true, usedFreeze: 0 }; }
  const missed = diff - 1; // full days skipped
  if (c.freezes >= missed && missed <= 2) {
    c.freezes -= missed; c.streak += 1; c.lastActive = t; save();
    return { streak: c.streak, changed: true, usedFreeze: missed };
  }
  c.streak = 1; c.lastActive = t; save();
  return { streak: 1, changed: true, usedFreeze: 0, reset: true };
}

// Call after completing a study or lesson. Practice earns freezes (capped).
export function recordActivity() {
  const c = get();
  c.practice = (c.practice || 0) + 1;
  let earned = 0;
  if (c.practice >= PRACTICE_PER_FREEZE) {
    if (c.freezes < FREEZE_CAP) { c.freezes += 1; earned = 1; c.practice = 0; }
    else { c.practice = PRACTICE_PER_FREEZE; } // hold at threshold until a freeze is spent
  }
  save();
  return { earnedFreeze: earned, freezes: c.freezes };
}

export const streakCount = () => get().streak;
export const freezeCount = () => get().freezes;
