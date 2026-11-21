// lessons.js — teaching content shown before you apply it. A Foundations set
// (p-value, effect size, significance-vs-importance, rater agreement) plus one
// focused lesson per career chapter. Grounded in standard research-stats sources
// (ASA 2016 on p-values; Cohen on effect size; the inter-rater reliability literature).

import { sampleNormal, bernoulli } from "./stats.js";
import { renderChart } from "./graphics.js";

// ---------- small schematic art (inline SVG, theme-aware) ----------

const artPValue = () => `
  <svg viewBox="0 0 280 150" class="lesson-art" role="img" aria-label="p-value is the tail area under the null">
    <path d="M20 118 C70 118 95 30 140 30 C185 30 210 118 260 118" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    <path d="M198 60 C216 80 236 104 260 118 L198 118 Z" fill="var(--accent)" fill-opacity="0.32"/>
    <line x1="198" y1="48" x2="198" y2="124" stroke="var(--muted)" stroke-dasharray="4 4"/>
    <text x="140" y="140" text-anchor="middle" font-size="11" fill="var(--muted)">results assuming nothing is going on</text>
    <text x="228" y="52" text-anchor="middle" font-size="11" font-weight="700" fill="var(--accent)">p</text>
  </svg>`;

const artEffect = () => `
  <svg viewBox="0 0 280 150" class="lesson-art" role="img" aria-label="effect size is the gap between groups">
    <path d="M14 120 C50 120 70 55 100 55 C130 55 150 120 186 120" fill="none" stroke="var(--muted)" stroke-width="2.5"/>
    <path d="M94 120 C130 120 150 55 180 55 C210 55 230 120 266 120" fill="none" stroke="var(--good)" stroke-width="2.5"/>
    <line x1="100" y1="44" x2="180" y2="44" stroke="var(--ink)" stroke-width="2"/>
    <path d="M100 44 l7 -4 v8 z" fill="var(--ink)"/><path d="M180 44 l-7 -4 v8 z" fill="var(--ink)"/>
    <text x="140" y="36" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">effect size (d)</text>
    <text x="70" y="140" text-anchor="middle" font-size="11" fill="var(--muted)">group A</text>
    <text x="214" y="140" text-anchor="middle" font-size="11" fill="var(--good)">group B</text>
  </svg>`;

const artQuadrant = () => `
  <svg viewBox="0 0 280 170" class="lesson-art" role="img" aria-label="significance by effect-size quadrants">
    <line x1="140" y1="18" x2="140" y2="140" stroke="var(--line)" stroke-width="1.5"/>
    <line x1="30" y1="79" x2="258" y2="79" stroke="var(--line)" stroke-width="1.5"/>
    <text x="85" y="50" text-anchor="middle" font-size="10.5" fill="var(--muted)">real, maybe<tspan x="85" dy="13">trivial</tspan></text>
    <text x="200" y="50" text-anchor="middle" font-size="10.5" fill="var(--good)">the goal</text>
    <text x="85" y="112" text-anchor="middle" font-size="10.5" fill="var(--muted)">nothing<tspan x="85" dy="13">here</tspan></text>
    <text x="200" y="112" text-anchor="middle" font-size="10.5" fill="var(--warn)">maybe<tspan x="200" dy="13">underpowered</tspan></text>
    <text x="140" y="158" text-anchor="middle" font-size="10.5" fill="var(--muted)">effect size →</text>
    <text x="18" y="79" text-anchor="middle" font-size="10.5" fill="var(--muted)" transform="rotate(-90 18 79)">significant ↑</text>
  </svg>`;

const artTree = () => `
  <svg viewBox="0 0 300 180" class="lesson-art" role="img" aria-label="method decision recap">
    <defs><marker id="la" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
    <rect x="12" y="74" width="92" height="34" rx="8" fill="none" stroke="var(--accent)" stroke-width="2"/>
    <text x="58" y="95" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">Outcome type?</text>
    <g stroke="var(--muted)" stroke-width="1.3" fill="none">
      <path d="M104 84 H150 V34 H186" marker-end="url(#la)"/>
      <path d="M104 98 H150 V140 H186" marker-end="url(#la)"/>
    </g>
    <text x="244" y="30" text-anchor="middle" font-size="11" fill="var(--ink)">Continuous</text>
    <text x="244" y="46" text-anchor="middle" font-size="10" fill="var(--muted)">t-test · ANOVA · regression</text>
    <text x="244" y="136" text-anchor="middle" font-size="11" fill="var(--ink)">Categorical</text>
    <text x="244" y="152" text-anchor="middle" font-size="10" fill="var(--muted)">chi-square · logistic</text>
  </svg>`;

// Career-chapter charts reuse the real chart renderer on fixed sample data.
const dTwo = { kind: "two", groups: [sampleNormal(22, 68, 7), sampleNormal(22, 76, 7)] };
const dReg = (() => { const x = sampleNormal(26, 10, 3); const y = x.map((h) => 40 + 4 * h + (Math.random() * 2 - 1) * 16); return { kind: "regression", x, y }; })();
const dLog = (() => { const x = sampleNormal(40, 50, 15); const y = x.map((d) => bernoulli(1 / (1 + Math.exp(-(-5 + 0.12 * d))))); return { kind: "logistic", x, y }; })();

// ---------- the lessons ----------

const FOUNDATIONS = [
  {
    title: "What a p-value really is",
    art: artPValue(),
    body: `
      <p>A <strong>p-value</strong> is the probability of seeing a result at least this extreme <em>if there were truly no effect</em> (the "null"). A small p means your data would be surprising in a world where nothing is going on — so it's evidence against "nothing is going on."</p>
      <p>Two traps the pros warn about (ASA, 2016):</p>
      <ul>
        <li>It is <strong>not</strong> the probability that your hypothesis is true.</li>
        <li>It is <strong>not</strong> the size of the effect — a tiny p can go with a tiny effect.</li>
      </ul>
      <p>And 0.05 is a convention, not a law: p = 0.049 and p = 0.051 are almost the same evidence.</p>`,
  },
  {
    title: "Effect size — how big, not just whether",
    art: artEffect(),
    body: `
      <p>The p-value asks <em>"is it real?"</em>. The <strong>effect size</strong> asks <em>"does it matter?"</em> — the magnitude of the difference or relationship.</p>
      <p>For a difference in means, <strong>Cohen's d</strong> is a common one: roughly <strong>0.2 small, 0.5 medium, 0.8 large</strong> (rules of thumb — context rules).</p>
      <p>With a big enough sample, a trivial effect can be "significant." With a small sample, a big effect can miss significance. Always report both.</p>`,
  },
  {
    title: "Significant vs important",
    art: artQuadrant(),
    body: `
      <p>Put the two ideas on a grid. The sweet spot is <strong>significant <em>and</em> a meaningful effect</strong> — top right.</p>
      <ul>
        <li><strong>Significant + tiny effect</strong>: real but maybe not worth acting on.</li>
        <li><strong>Not significant + big effect</strong>: often just <em>underpowered</em> — too small a sample.</li>
      </ul>
      <p>That link between effect size, sample size and detection is exactly the <strong>budget step</strong> you'll play later.</p>`,
  },
  {
    title: "Do your raters agree?",
    art: null,
    body: `
      <p>When two or more people code or rate the same items, you must show they <strong>agree</strong> — and, true to this game, pick the <em>right coefficient</em> for the situation.</p>
      <table class="lesson-table">
        <tr><th>Situation</th><th>Use</th></tr>
        <tr><td>Quick gut check</td><td><strong>% agreement</strong> — but it ignores chance, so report it only alongside one below</td></tr>
        <tr><td>2 raters, categories</td><td><strong>Cohen's κ</strong> (weighted κ for ordered categories)</td></tr>
        <tr><td>3+ raters, categories</td><td><strong>Fleiss' κ</strong></td></tr>
        <tr><td>Any raters / data type, missing data</td><td><strong>Krippendorff's α</strong> (most flexible)</td></tr>
        <tr><td>Continuous ratings</td><td><strong>ICC</strong> (consistency vs absolute agreement)</td></tr>
      </table>
      <p>Aim for κ &gt; 0.70. Watch the <strong>kappa paradox</strong>: when one category dominates, κ can look low even with high agreement — Gwet's AC1 is more robust there.</p>`,
  },
];

export const LESSONS = {
  foundations: FOUNDATIONS,
  intern: [
    {
      title: "Your outcome type is the master key",
      art: renderChart(dTwo),
      body: `
        <p>Before any test, name two things: the <strong>outcome type</strong> and the <strong>design</strong>. For a number (continuous) compared across <strong>two groups</strong>, you're in t-test territory.</p>
        <ul>
          <li><strong>Same units measured twice</strong> (before/after) → <strong>paired</strong> t-test.</li>
          <li><strong>Different units in each group</strong> → <strong>independent</strong> t-test.</li>
        </ul>
        <p>The chart shows two groups of observations — each dot one measurement, the bar each group's mean.</p>`,
    },
  ],
  ra: [
    {
      title: "More groups, and relationships",
      art: renderChart(dReg),
      body: `
        <p>Two moves beyond the t-test:</p>
        <ul>
          <li><strong>Three or more groups</strong> → one-way <strong>ANOVA</strong>, not a pile of t-tests (which inflate false positives).</li>
          <li><strong>A continuous predictor</strong> (not groups) → <strong>linear regression</strong>, which estimates the slope.</li>
        </ul>
        <p>Here, each dot is a case; the line is the fitted relationship between predictor and outcome.</p>`,
    },
  ],
  phd: [
    {
      title: "When the outcome is a category",
      art: renderChart(dLog),
      body: `
        <p>Yes/no and category outcomes don't fit a t-test at all.</p>
        <ul>
          <li><strong>Association between two categories</strong> → <strong>chi-square</strong>.</li>
          <li><strong>Predict a binary outcome from a predictor</strong> → <strong>logistic regression</strong>, which keeps predictions between 0 and 1 (the curve below).</li>
        </ul>`,
    },
  ],
  pi: [
    {
      title: "The whole decision tree",
      art: artTree(),
      body: `
        <p>One rule drives everything you've learned: <strong>outcome type + design → method.</strong></p>
        <ul>
          <li>Continuous → t-test (2 groups) · ANOVA (3+) · regression (continuous predictor)</li>
          <li>Categorical → chi-square (association) · logistic (predict binary)</li>
        </ul>
        <p>No warm-up from here — read each study and pick from the whole tree.</p>`,
    },
  ],
};
