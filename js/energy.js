// energy.js — "lab energy" that drains when you run a study and refills over real
// time. Persisted to localStorage with a timestamp, so it keeps regenerating while
// the app is closed — that's the come-back-later hook.

const EKEY = "statsTycoonEnergy";
export const MAX_ENERGY = 5;          // the timer tops you up to here
export const REGEN_MS = 2 * 60 * 1000; // slow safety-net: one energy every 2 minutes
const FIRST_ENERGY = 3;                // a brand-new lesson pays this (can bank above MAX)
const REVIEW_ENERGY = 1;              // re-reading a lesson tops up, but only to MAX

const now = () => Date.now();
let cache = null;

function read() {
  try {
    const raw = localStorage.getItem(EKEY);
    if (raw) { const p = JSON.parse(raw); if (!p.earned) p.earned = {}; return p; }
  } catch (e) {}
  return { energy: MAX_ENERGY, lastTs: now(), earned: {} };
}
function write() {
  try {
    localStorage.setItem(EKEY, JSON.stringify(cache));
  } catch (e) {}
}

// Bring the cache up to date: grant any energy earned since lastTs.
export function refresh() {
  if (!cache) cache = read();
  if (cache.energy >= MAX_ENERGY) {
    cache.lastTs = now();
    return cache;
  }
  const elapsed = now() - cache.lastTs;
  if (elapsed > 0) {
    const gained = Math.floor(elapsed / REGEN_MS);
    if (gained > 0) {
      cache.energy = Math.min(MAX_ENERGY, cache.energy + gained);
      if (cache.energy >= MAX_ENERGY) cache.lastTs = now();
      else cache.lastTs += gained * REGEN_MS;
      write();
    }
  }
  return cache;
}

export const energy = () => refresh().energy;

// Spend n energy if available; returns true on success.
export function spend(n = 1) {
  refresh();
  if (cache.energy >= n) {
    if (cache.energy >= MAX_ENERGY) cache.lastTs = now(); // start the regen clock when dropping below full
    cache.energy -= n;
    write();
    return true;
  }
  return false;
}

// A lesson pays energy. First completion gives FIRST (bankable above MAX);
// re-reading only tops you up to MAX. Returns { amount, first }.
export function grantForLesson(key) {
  refresh();
  if (!cache.earned) cache.earned = {};
  if (!cache.earned[key]) {
    cache.earned[key] = true;
    cache.energy += FIRST_ENERGY;
    write();
    return { amount: FIRST_ENERGY, first: true };
  }
  if (cache.energy < MAX_ENERGY) {
    const add = Math.min(REVIEW_ENERGY, MAX_ENERGY - cache.energy);
    cache.energy += add;
    write();
    return { amount: add, first: false };
  }
  return { amount: 0, first: false };
}

// Award energy for a big activity (e.g., finishing a full study). Banks above MAX.
export function award(n) {
  refresh();
  cache.energy += n;
  write();
  return n;
}

export function msToNext() {
  refresh();
  if (cache.energy >= MAX_ENERGY) return 0;
  return Math.max(0, REGEN_MS - (now() - cache.lastTs));
}

export function msToFull() {
  refresh();
  if (cache.energy >= MAX_ENERGY) return 0;
  return (MAX_ENERGY - cache.energy - 1) * REGEN_MS + msToNext();
}

export function fmtClock(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// A compact numeric label for the HUD (handles banked energy above MAX).
export function energyPips() {
  return `⚡ ${energy()}`;
}
