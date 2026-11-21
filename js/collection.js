// collection.js — the meta-game: a pickable avatar, unlockable lab items earned by
// playing well, and seasonal items for the current month. All saved to localStorage.

const CKEY = "statsTycoonCollection";

export const AVATARS = [
  { id: "sci1", e: "🧑‍🔬", name: "Scientist" },
  { id: "sci2", e: "👩‍🔬", name: "Researcher" },
  { id: "sci3", e: "👨‍🔬", name: "Professor" },
  { id: "cat", e: "🐱", name: "Lab Cat" },
  { id: "robot", e: "🤖", name: "Lab Bot" },
  { id: "owl", e: "🦉", name: "Wise Owl" },
];

// Unlockable lab items. cond(stats) decides when each is earned.
export const ITEMS = [
  { id: "alembic", e: "⚗️", name: "Alembic", hint: "Get your first method right", cond: (s) => s.correct >= 1 },
  { id: "microscope", e: "🔬", name: "Microscope", hint: "Pass your first chapter", cond: (s) => s.chapters >= 1 },
  { id: "telescope", e: "🔭", name: "Telescope", hint: "Reach Research Assistant", cond: (s) => s.rank >= 1 },
  { id: "plant", e: "🪴", name: "Lab Plant", hint: "Get 5 methods right", cond: (s) => s.correct >= 5 },
  { id: "dna", e: "🧬", name: "DNA Model", hint: "Earn a ★★★ chapter", cond: (s) => s.topStars >= 3 },
  { id: "atom", e: "⚛️", name: "Atom Model", hint: "Reach PhD Candidate", cond: (s) => s.rank >= 2 },
  { id: "bot", e: "🦾", name: "Robotic Arm", hint: "Nail 3 perfect studies", cond: (s) => s.perfect >= 3 },
  { id: "medal", e: "🏅", name: "Gold Medal", hint: "Collect 6 stars in all", cond: (s) => s.stars >= 6 },
  { id: "rocket", e: "🚀", name: "Rocket", hint: "Reach Principal Investigator", cond: (s) => s.rank >= 3 },
  { id: "crystal", e: "🔮", name: "Crystal Ball", hint: "Get 10 methods right", cond: (s) => s.correct >= 10 },
];

// Seasonal items, by month index (0 = Jan). Auto-collected during their month.
export const SEASONAL = {
  9: [{ id: "pumpkin", e: "🎃", name: "Pumpkin" }, { id: "bat", e: "🦇", name: "Lab Bat" }],        // Oct
  10: [{ id: "leaves", e: "🍂", name: "Autumn Leaves" }, { id: "acorn", e: "🌰", name: "Acorn" }],   // Nov
  11: [{ id: "snowglobe", e: "❄️", name: "Snow Globe" }, { id: "tree", e: "🎄", name: "Lab Tree" }], // Dec
  0: [{ id: "spark", e: "🎆", name: "New-Year Spark" }],                                             // Jan
  1: [{ id: "heart", e: "💗", name: "Heart Flask" }],                                                // Feb
  6: [{ id: "sun", e: "☀️", name: "Summer Sun" }, { id: "icecream", e: "🍦", name: "Ice Cream" }],   // Jul
};

export const seasonalNow = () => SEASONAL[new Date().getMonth()] || [];
export const allKnownItems = () => [...ITEMS, ...Object.values(SEASONAL).flat()];

let cache = null;

function load() {
  try {
    const raw = localStorage.getItem(CKEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { avatar: "sci1", unlocked: [], seen: [], stats: { correct: 0, perfect: 0, chapters: 0, stars: 0, topStars: 0, rank: 0 } };
}
function save() { try { localStorage.setItem(CKEY, JSON.stringify(cache)); } catch (e) {} }
function get() { if (!cache) cache = load(); return cache; }

export const collection = () => get();
export const totalItems = () => ITEMS.length;
export const isUnlocked = (id) => get().unlocked.includes(id);

export function setAvatar(id) { get().avatar = id; save(); }
export function avatarEmoji() {
  const c = get();
  return (AVATARS.find((a) => a.id === c.avatar) || AVATARS[0]).e;
}

// Grant any items whose condition is now met (plus this month's seasonal). Returns the new ones.
function evaluate() {
  const c = get();
  const news = [];
  for (const it of ITEMS) {
    if (!c.unlocked.includes(it.id) && it.cond(c.stats)) { c.unlocked.push(it.id); news.push(it); }
  }
  for (const it of seasonalNow()) {
    if (!c.unlocked.includes(it.id)) { c.unlocked.push(it.id); news.push({ ...it, seasonal: true }); }
  }
  if (news.length) save();
  return news;
}

export function recordStudy(correctMethod, score) {
  const c = get();
  if (correctMethod) c.stats.correct++;
  if (score >= 100) c.stats.perfect++;
  save();
  return evaluate();
}

export function syncProgress(progress) {
  const c = get();
  const vals = Object.values(progress.stars || {});
  c.stats.chapters = Object.keys(progress.stars || {}).length;
  c.stats.stars = vals.reduce((a, b) => a + b, 0);
  c.stats.topStars = vals.length ? Math.max(...vals) : 0;
  c.stats.rank = progress.unlocked;
  save();
  return evaluate();
}

export function newCount() {
  const c = get();
  return c.unlocked.filter((id) => !c.seen.includes(id)).length;
}
export function markSeen() {
  const c = get();
  c.seen = [...c.unlocked];
  save();
}
