// lessons.js — teaching content shown before you apply it. Each lesson can carry an
// interactive "test the theory" DEMO and a concept-check QUIZ (you must answer to go
// on). A Foundations set (p-value, effect size, significance-vs-importance, rater
// agreement) plus one focused lesson per career chapter. Grounded in standard
// research-stats sources (ASA 2016 on p-values; Cohen on effect size; the IRR literature).

import { sampleNormal, bernoulli } from "./stats.js";
import { renderChart } from "./graphics.js";

// ---------- small schematic art (inline SVG, theme-aware) ----------

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
    body: `
      <p>A <strong>p-value</strong> is the probability of seeing a result at least this extreme <em>if there were truly no effect</em> (the "null"). Small p = your data would be surprising in a world where nothing is going on.</p>
      <p>Below, two groups are drawn from the <em>same</em> population — so there's <strong>no real effect</strong>. Run it a bunch and watch how often you still get a "significant" p &lt; 0.05 by pure luck.</p>`,
    demo: "pvalue",
    quiz: {
      skill: "pvalue",
      q: "A study reports p = 0.03. What does that mean?",
      options: [
        { t: "If there were no real effect, data this extreme would happen ~3% of the time", ok: true, why: "Exactly — it's computed assuming the null is true." },
        { t: "There's a 3% chance the hypothesis is true", why: "Common trap — a p-value is not the probability a hypothesis is true (ASA 2016)." },
        { t: "The effect is 3% in size", why: "p-values say nothing about the size of an effect." },
      ],
    },
  },
  {
    title: "Effect size — how big, not just whether",
    body: `
      <p>The p-value asks <em>"is it real?"</em>. The <strong>effect size</strong> asks <em>"does it matter?"</em> Drag the slider to see how <strong>Cohen's d</strong> separates two groups — roughly 0.2 small, 0.5 medium, 0.8 large.</p>`,
    demo: "effect",
    quiz: {
      skill: "effect-size",
      q: "A huge study finds p < 0.001 but Cohen's d = 0.04. Best read?",
      options: [
        { t: "A real but tiny effect — probably not worth acting on", ok: true, why: "A large sample makes even a trivial effect 'significant'. d = 0.04 is tiny." },
        { t: "A large, important effect", why: "A small p does not mean a big effect — d = 0.04 is negligible." },
        { t: "The analysis must be wrong", why: "Not at all — significant + tiny effect is common with big samples." },
      ],
    },
  },
  {
    title: "Significant vs important",
    art: artQuadrant(),
    body: `
      <p>Put the two ideas on a grid. The sweet spot is <strong>significant <em>and</em> a meaningful effect</strong> — top right. The link between effect size, sample size and detection is exactly the <strong>budget step</strong> you'll play.</p>`,
    quiz: {
      skill: "significance",
      q: "Your result is NOT significant, but the observed effect looks large. Most likely?",
      options: [
        { t: "Underpowered — the sample was too small", ok: true, why: "A big effect that misses significance usually means too few observations." },
        { t: "There is definitely no effect", why: "Not significant ≠ no effect, especially with a small sample." },
        { t: "You must have p-hacked", why: "p-hacking inflates false positives; it doesn't explain a missed large effect." },
      ],
    },
  },
  {
    title: "Do your raters agree?",
    body: `
      <p>When two or more people code or rate the same items, you must show they <strong>agree</strong> — and pick the <em>right coefficient</em> for the situation.</p>
      <table class="lesson-table">
        <tr><th>Situation</th><th>Use</th></tr>
        <tr><td>Quick gut check</td><td><strong>% agreement</strong> — ignores chance; report only alongside one below</td></tr>
        <tr><td>2 raters, categories</td><td><strong>Cohen's κ</strong> (weighted κ for ordered categories)</td></tr>
        <tr><td>3+ raters, categories</td><td><strong>Fleiss' κ</strong></td></tr>
        <tr><td>Any raters / data type, missing data</td><td><strong>Krippendorff's α</strong></td></tr>
        <tr><td>Continuous ratings</td><td><strong>ICC</strong></td></tr>
      </table>
      <p>Aim for κ &gt; 0.70, and watch the <strong>kappa paradox</strong> when one category dominates.</p>`,
    quiz: {
      skill: "irr",
      q: "Three reviewers each sort papers into categories. Which coefficient?",
      options: [
        { t: "Fleiss' κ", ok: true, why: "3+ raters on categories → Fleiss' κ." },
        { t: "Cohen's κ", why: "Cohen's κ is for exactly two raters." },
        { t: "ICC", why: "ICC is for continuous ratings, not categories." },
      ],
    },
  },
];

export const LESSONS = {
  foundations: FOUNDATIONS,
  intern: [
    {
      title: "Your outcome type is the master key",
      art: renderChart(dTwo),
      body: `
        <p>Before any test, name the <strong>outcome type</strong> and the <strong>design</strong>. For a number (continuous) across <strong>two groups</strong>, you're in t-test territory: <strong>paired</strong> if the same units are measured twice, <strong>independent</strong> if the groups are different units.</p>`,
      quiz: {
        skill: "paired-ttest",
        q: "You measure the SAME patients before and after a drug. Which test?",
        options: [
          { t: "Paired t-test", ok: true, why: "Same units measured twice → paired." },
          { t: "Independent t-test", why: "That's for two different groups of units." },
          { t: "Chi-square", why: "Chi-square is for categorical outcomes." },
        ],
      },
    },
  ],
  ra: [
    {
      title: "More groups, and relationships",
      art: renderChart(dReg),
      body: `
        <p>Two moves beyond the t-test: <strong>three or more groups</strong> → one-way <strong>ANOVA</strong> (not a pile of t-tests), and <strong>a continuous predictor</strong> → <strong>linear regression</strong>, which estimates the slope.</p>`,
      quiz: {
        skill: "anova",
        q: "You compare mean crop yield across 4 fertilizers. Which test?",
        options: [
          { t: "One-way ANOVA", ok: true, why: "3+ groups → ANOVA; separate t-tests would inflate false positives." },
          { t: "Two-sample t-test", why: "A t-test compares only two groups." },
          { t: "Chi-square", why: "Yield is continuous, not categorical." },
        ],
      },
    },
  ],
  phd: [
    {
      title: "When the outcome is a category",
      art: renderChart(dLog),
      body: `
        <p>Yes/no and category outcomes don't fit a t-test. <strong>Association between two categories</strong> → <strong>chi-square</strong>. <strong>Predict a binary outcome from a predictor</strong> → <strong>logistic regression</strong> (keeps predictions between 0 and 1).</p>`,
      quiz: {
        skill: "logistic",
        q: "Predict whether a patient relapses (yes/no) from their age (a number). Which method?",
        options: [
          { t: "Logistic regression", ok: true, why: "Binary outcome + a predictor → logistic." },
          { t: "Linear regression", why: "Linear can predict impossible probabilities below 0 or above 1." },
          { t: "Chi-square", why: "Age is continuous; chi-square needs categories." },
        ],
      },
    },
  ],
  pi: [
    {
      title: "The whole decision tree",
      art: artTree(),
      body: `
        <p>One rule drives everything: <strong>outcome type + design → method.</strong> Continuous → t-test / ANOVA / regression. Categorical → chi-square / logistic. No warm-up from here.</p>`,
      quiz: {
        skill: "linear",
        q: "Continuous outcome, predicted from one continuous predictor. Which method?",
        options: [
          { t: "Linear regression", ok: true, why: "Continuous outcome + continuous predictor → linear regression." },
          { t: "One-way ANOVA", why: "ANOVA compares group means, not a continuous predictor." },
          { t: "Logistic regression", why: "Logistic is for binary outcomes." },
        ],
      },
    },
  ],
};
