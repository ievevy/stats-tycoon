// energy.js — "lab energy" that drains when you run a study and refills over real
// time. Persisted to localStorage with a timestamp, so it keeps regenerating while
// the app is closed — that's the come-back-later hook.

const EKEY = "statsTycoonEnergy";
export const MAX_ENERGY = 5;
export const REGEN_MS = 2 * 60 * 1000; // one energy every 2 minutes

const now = () => Date.now();
let cache = null;

function read() {
  try {
    const raw = localStorage.getItem(EKEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { energy: MAX_ENERGY, lastTs: now() };
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
    if (cache.energy === MAX_ENERGY) cache.lastTs = now(); // start the regen clock
    cache.energy -= n;
    write();
    return true;
  }
  return false;
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

// A compact "⚡ pips" label for the HUD.
export function energyPips() {
  const e = energy();
  let pips = "";
  for (let i = 0; i < MAX_ENERGY; i++) pips += i < e ? "⚡" : "·";
  return pips;
}
