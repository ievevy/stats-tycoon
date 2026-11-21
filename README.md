# Stats Tycoon

A tiny tycoon-style game for learning **which statistical method to use** under a
given hypothesis and experimental design. You run a research lab: for each study,
read the data, classify the problem, budget your sample, and pick a method. The game
draws **real simulated data** from a known ground truth and grades your choice against
reality — a wrong method still prints a p-value, which is exactly the trap.

This is the MVP described in the design doc: the **decision-tree core** (continuous +
binary branches) plus a **power/budget** slice.

## What's here

```
index.html              # app shell
css/styles.css          # mobile-first styling, light + dark, animations
js/stats.js             # sampling + t-test, paired t, ANOVA, regression,
                        #   chi-square, logistic, approx power (no dependencies)
js/scenarios.js         # hand-authored studies, each with its ground truth
js/levels.js            # career ladder: ranks, story chapters, scoring
js/lessons.js           # teaching content (Foundations + per-chapter) + visuals
js/energy.js            # lab-energy: drain on run, timed regen, persisted
js/collection.js        # avatar, unlockable lab items, seasonal items
js/graphics.js          # data charts, flask mascot, confetti
js/app.js               # the game loop + career map + My Lab + progress saving
manifest.webmanifest    # PWA manifest
sw.js                   # service worker (offline)
icons/                  # app icons (PNG)
```

## Teach, then apply

Every chapter now opens with a short **Lesson** before its studies, so you learn the
concept before you're graded on it (Story → Lesson → Studies → Debrief). The lessons
reuse the real chart renderer and schematic diagrams, and the content is grounded in
standard sources (ASA 2016 on p-values; Cohen on effect size; the inter-rater
reliability literature).

The ladder starts with an **Orientation: Foundations** chapter (no studies) covering
the basics — **what a p-value is, effect size, significance vs importance, and which
inter-rater reliability coefficient to use when** (% agreement, Cohen's κ, Fleiss' κ,
Krippendorff's α, ICC). Completing it unlocks Chapter 1.

## Career progression

The game is a career ladder. You climb ranks by passing chapters:

**Foundations → Lab Intern → Research Assistant → PhD Candidate → Principal Investigator**
(with Department Head & Nobel Laureate as locked "coming soon" ranks).

Each chapter has a short story and a set of studies. Every study is scored 0–100
(right method + right classification + adequate power). A chapter's average decides
your **stars** (★ at 55, ★★ at 72, ★★★ at 90); reaching the pass mark unlocks the
next rank. Progress — unlocked ranks and stars — is saved in `localStorage`, so it
persists across reloads and on the installed phone app.

### Lab energy

Running a study costs **⚡1 lab energy** (max 5). When you run out, you hit a
recharge screen with a live countdown; energy refills **one point every 2 minutes**
of real time — even while the app is closed — which is the come-back-later hook.
Energy and its timestamp live in `localStorage` ([js/energy.js](js/energy.js)); the
regen rate is the `REGEN_MS` constant there.

### My Lab (avatar + collectibles)

The map has a **My Lab** screen ([js/collection.js](js/collection.js)):

- **Avatar picker** — choose your scientist (saved, shown on the map and lab shelf).
- **Lab items** — 10 items you unlock by playing well (first correct method, pass a
  chapter, reach a rank, earn ★★★, nail perfect studies…). An unlock pops a "✨ New
  lab item!" toast in the debrief, and the item lands on your lab shelf.
- **Seasonal items** — a couple of items for the current month (e.g. autumn leaves in
  November, a snow globe in December), auto-collected while in season.

Everything is saved in `localStorage`, so your avatar and collection persist.

No build step, no backend, no dependencies — it's a static site that runs entirely
in the browser.

## Run it locally

From this folder, start any static server. A service worker needs `http://localhost`
(not `file://`), so open it over localhost:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in a browser.

## Install on your iPhone (PWA)

1. Serve the folder somewhere your phone can reach it — the simplest options:
   - Run the command above on your Mac and open `http://<your-mac-ip>:8000` in Safari
     on the phone (same Wi-Fi), **or**
   - Host the folder for free on GitHub Pages / Netlify / Cloudflare Pages / Vercel
     and open that URL in Safari.
2. In Safari, tap the **Share** button → **Add to Home Screen**.
3. Launch it from the home-screen icon. After the first load it works **offline**.

> iOS only installs PWAs from **Safari** (not Chrome/Firefox on iOS), and the service
> worker needs HTTPS when not on localhost — any of the free hosts above provide it.

## The six studies

Each exercises one solid box of the decision tree:

| Study | Design | Correct method |
| --- | --- | --- |
| The tutoring app | same students, before/after | Paired t-test |
| Two teaching methods | two independent classes | Two-sample t-test |
| Three fertilizers | three groups | One-way ANOVA |
| Study hours vs score | continuous predictor | Linear regression |
| Treatment vs control | 2×2 recovered yes/no | Chi-square test |
| Dose vs side-effect | binary outcome, continuous predictor | Logistic regression |

## Extending it

- **Add a scenario**: append an object to `scenarios` in `js/scenarios.js` with a
  `simulate(n)` that returns data plus its ground-truth metadata.
- **Add a method**: add a test to `js/stats.js`, a label in `METHOD_LABELS`, and a
  branch in `runMethod()` in `js/app.js`.
- Later expansions (multinomial/GLM, prediction vs inference, RL/bandits, pitfalls)
  are mapped in the design doc's roadmap.
