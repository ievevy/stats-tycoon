// sw.js — a tiny offline cache so the game works after "Add to Home Screen".
const CACHE = "stats-tycoon-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/stats.js",
  "./js/scenarios.js",
  "./js/graphics.js",
  "./js/levels.js",
  "./js/energy.js",
  "./js/collection.js",
  "./js/lessons.js",
  "./js/skills.js",
  "./js/streak.js",
  "./js/questions.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: fresh when online (so updates apply on reload), cache when offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // revalidate with the server (no-cache) so updates always apply; fall back to cache offline
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
