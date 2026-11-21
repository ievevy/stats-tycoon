// helper.js — a built-in, offline Q&A assistant (no API key). It keyword-matches
// the player's question to a local knowledge base drawn from the lessons. Limited
// but safe and free; a real AI tutor can be added later via a backend proxy.

export const SUGGESTIONS = [
  "What is a p-value?",
  "Which test should I use?",
  "What is statistical power?",
  "Paired or independent?",
  "What is effect size?",
];

const KB = [
  { k: ["p-value", "p value", "pvalue", "significan", "0.05"], a: "A p-value is the probability of seeing a result at least this extreme IF there were truly no effect (the null). A small p means your data would be surprising when nothing is going on → evidence against the null. It is NOT the probability your hypothesis is true, and NOT the size of the effect (ASA, 2016)." },
  { k: ["effect size", "cohen", "how big", "magnitude", "practical signif"], a: "Effect size measures how BIG a difference or relationship is — separate from whether it's significant. Cohen's d ≈ 0.2 small, 0.5 medium, 0.8 large (rough rules). With a big enough sample, even a trivial effect can be 'significant', so always report both." },
  { k: ["power", "sample size", "how many", "participants", "underpowered", "how big a sample"], a: "Statistical power is the chance your study detects a real effect. It rises with a bigger true effect and a bigger sample. Aim for ≥ 80%. Too small a sample → underpowered → you can miss real effects. There's no single magic n: pick it so power ≥ 80% for the smallest effect you'd care about." },
  { k: ["which test", "what test", "which method", "choose", "decision tree", "what analysis", "what should i use"], a: "Two facts decide it: your OUTCOME type and your DESIGN. Continuous outcome → t-test (2 groups), ANOVA (3+ groups), or regression (a continuous predictor). Categorical outcome → chi-square (association) or logistic regression (predict yes/no). Same units measured twice = paired." },
  { k: ["paired", "independent", "before after", "same people", "same participants", "matched"], a: "Paired = the SAME units measured twice (before/after) or matched — use a paired test, which removes between-subject variation. Independent = DIFFERENT units in each group — use a two-sample test. Different classes/patients in each arm → independent." },
  { k: ["t-test", "t test", "ttest"], a: "A t-test compares the MEANS of two groups on a continuous outcome. Independent t-test for two separate groups; paired t-test for the same units measured twice. For 3+ groups, use ANOVA instead." },
  { k: ["anova", "three groups", "3 groups", "multiple groups", "more than two"], a: "ANOVA compares means across THREE or more groups in one omnibus test. Don't run many t-tests instead — that inflates false positives. A significant ANOVA says 'some group differs'; follow up to find which." },
  { k: ["chi-square", "chi square", "categorical", "contingency", "association"], a: "Chi-square tests whether two CATEGORICAL variables are associated (e.g., group × recovered yes/no) using a contingency table. If an expected count is very small, use Fisher's exact test instead." },
  { k: ["logistic", "binary outcome", "yes/no", "yes no", "odds"], a: "Logistic regression predicts a BINARY outcome (yes/no) from one or more predictors, keeping predicted probabilities between 0 and 1. Use it instead of linear regression when the outcome is yes/no." },
  { k: ["regression", "linear", "slope", "predictor", "correlation", "relationship"], a: "Linear regression models a CONTINUOUS outcome from a continuous predictor and estimates the slope (how much y changes per unit of x). Correlation measures the strength of a linear relationship; regression also gives its size and direction." },
  { k: ["hypothesis", "null", "h0", "h1", "alternative"], a: "The null (H₀) says 'no effect / no difference'; the alternative (H₁) says there is one. You test whether the data are surprising under H₀. You never 'prove' H₁ — you gather evidence against H₀." },
  { k: ["cause", "causal", "causation", "confound", "correlation vs"], a: "An association is NOT causation on its own. You can claim cause mainly from a randomized experiment, where randomization balances out confounders. In observational data, a hidden third variable could explain the link." },
  { k: ["assumption", "normal", "nonparametric", "skew"], a: "Most classic tests assume roughly normal data, independent observations, and similar spread across groups. If those are badly violated (very skewed, tiny n), use a nonparametric alternative like Mann-Whitney or Kruskal-Wallis." },
  { k: ["rater", "kappa", "agreement", "reliability", "icc", "krippendorff", "inter-rater"], a: "To show raters agree: percent agreement (descriptive only — ignores chance), Cohen's κ (2 raters, categories), Fleiss' κ (3+ raters), Krippendorff's α (any raters/data type, missing data), or ICC (continuous ratings). Aim for κ > 0.70; watch the 'kappa paradox' when one category dominates." },
  { k: ["limit", "caveat", "generali", "over-claim", "overclaim", "confidence"], a: "Always state a finding's limits: it's usually one study (needs replication), it rests on the test's assumptions, it describes AVERAGES (not every individual), it generalizes only to people like those sampled, and a causal claim needs randomization. Evidence, not proof." },
  { k: ["energy", "streak", "freeze", "how to play", "how do i play"], a: "Lessons give you ⚡ energy; each study you run costs ⚡1. Keep a daily 🔥 streak by playing each day — practice earns ❄️ freezes that cover a missed day. Your per-skill mastery is tracked in My Lab." },
];

export function answer(query) {
  const q = (query || "").toLowerCase();
  let best = null, bestScore = 0;
  for (const e of KB) {
    let s = 0;
    for (const kw of e.k) if (q.includes(kw)) s += kw.length;
    if (s > bestScore) { bestScore = s; best = e; }
  }
  if (best && bestScore > 0) return best.a;
  return "I'm a simple built-in helper (offline). I can explain p-values, effect size, power & sample size, which test to use, paired vs independent, ANOVA, chi-square, logistic/linear regression, hypotheses, causation, assumptions, and rater agreement. Try one of those — a full AI tutor can be added later.";
}
