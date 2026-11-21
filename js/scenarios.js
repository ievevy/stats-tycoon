// scenarios.js — hand-authored studies. Each knows its ground truth, so the
// game can draw real data and grade the player's method against reality.
//
// Every scenario exposes:
//   classify : the correct answers for the classify step
//   method   : the correct method id (a solid box in the decision tree)
//   wrong    : the common wrong method id (the trap)
//   effect   : standardized effect size, for the power/budget step
//   powerModel : 'two' | 'paired' | 'generic'
//   effectReal : is there truly an effect? (for the debrief verdict)
//   simulate(n): draw a dataset of size n from the true distribution

import { sampleNormal, bernoulli } from "./stats.js";

export const scenarios = [
  {
    id: "tutoring",
    skill: "paired-ttest",
    hints: [
      "What's the outcome type, and are the SAME people measured more than once?",
      "Same units measured twice (before/after) → it's paired. Use the paired version of the t-test.",
    ],
    title: "The tutoring app",
    prompt:
      "Does a new tutoring app raise test scores? You measure the SAME students before and after using it for a term.",
    dataNote: "Before / after score for each student (paired).",
    classify: { outcome: "continuous", groups: "two", paired: "paired" },
    method: "paired_t",
    wrong: "t_test",
    effect: 0.55, // mean diff / sd of differences
    powerModel: "paired",
    effectReal: true,
    truthText:
      "There is a real improvement of about 6 points (SD of the change ≈ 11). It is modest, so pairing matters.",
    teach:
      "Same students measured twice → the two columns are PAIRED. A paired t-test removes between-student variation; an independent t-test leaves it in and often hides a real effect.",
    simulate(n) {
      // each student has a baseline; the app adds a real +6 with noise
      const before = sampleNormal(n, 500, 90);
      const after = before.map((b) => b + 6 + (Math.random() * 2 - 1) * 11);
      return { kind: "paired", before, after };
    },
  },
  {
    id: "two-methods",
    skill: "independent-ttest",
    hints: [
      "Are the two groups the same people, or different people?",
      "Different classes = different people → two independent groups of a continuous score → two-sample t-test.",
    ],
    title: "Two teaching methods",
    prompt:
      "Two DIFFERENT classes are each taught with a different method. Do their final exam scores differ?",
    dataNote: "Scores from two independent groups of students.",
    classify: { outcome: "continuous", groups: "two", paired: "independent" },
    method: "t_test",
    wrong: "paired_t",
    effect: 0.5,
    powerModel: "two",
    effectReal: true,
    truthText:
      "Method B truly scores about 6 points higher (SD ≈ 12). Different students → independent groups.",
    teach:
      "Different people in each group → INDEPENDENT samples. A two-sample (Welch) t-test is right. A paired test is impossible here — there is no natural pairing between the two classes.",
    simulate(n) {
      const a = sampleNormal(n, 72, 12);
      const b = sampleNormal(n, 78, 12);
      return { kind: "two", groups: [a, b] };
    },
  },
  {
    id: "fertilizer",
    skill: "anova",
    hints: [
      "How many groups are you comparing at once?",
      "Three or more groups → one omnibus test, not a pile of t-tests. That's one-way ANOVA.",
    ],
    title: "Three fertilizers",
    prompt:
      "You test THREE fertilizers on crop yield, one per plot. Do the fertilizers differ in average yield?",
    dataNote: "Yield from three independent groups of plots.",
    classify: { outcome: "continuous", groups: "three_plus", paired: "independent" },
    method: "anova",
    wrong: "t_test",
    effect: 0.45,
    powerModel: "generic",
    effectReal: true,
    truthText:
      "Fertilizer C yields more than A and B (means 40 / 41 / 47, SD ≈ 10). Three groups → one omnibus test.",
    teach:
      "Three or more groups → one-way ANOVA, not a pile of t-tests. Running three t-tests inflates the false-positive rate; ANOVA asks 'are any different?' in a single test.",
    simulate(n) {
      const a = sampleNormal(n, 40, 10);
      const b = sampleNormal(n, 41, 10);
      const c = sampleNormal(n, 47, 10);
      return { kind: "multi", groups: [a, b, c] };
    },
  },
  {
    id: "study-hours",
    skill: "linear",
    hints: [
      "Is the predictor a set of groups, or a continuous number?",
      "A continuous predictor against a continuous outcome → linear regression (it estimates the slope).",
    ],
    title: "Study hours vs score",
    prompt:
      "Does the NUMBER of hours studied predict exam score? Both are measured on a continuous scale.",
    dataNote: "Hours studied (x) and exam score (y) for each student.",
    classify: { outcome: "continuous", groups: "predictor", paired: "independent" },
    method: "linear",
    wrong: "t_test",
    effect: 0.45,
    powerModel: "generic",
    effectReal: true,
    truthText:
      "Each extra hour adds about 4 points on average (real positive slope, with scatter).",
    teach:
      "A continuous predictor against a continuous outcome → linear regression, which estimates the slope. A t-test needs groups; there are none here, only a continuous x.",
    simulate(n) {
      const x = sampleNormal(n, 10, 3);
      const y = x.map((h) => 40 + 4 * h + (Math.random() * 2 - 1) * 18);
      return { kind: "regression", x, y };
    },
  },
  {
    id: "treatment",
    skill: "chi-square",
    hints: [
      "Is 'recovered?' a number, or a category (yes/no)?",
      "Two categories crossed (group × yes/no) → chi-square test of independence.",
    ],
    title: "Treatment vs control",
    prompt:
      "Patients get a treatment or a placebo. Each either RECOVERS or does not. Is recovery associated with the treatment?",
    dataNote: "A 2×2 table: treatment/control × recovered yes/no.",
    classify: { outcome: "binary", groups: "two", paired: "independent" },
    method: "chi_square",
    wrong: "t_test",
    effect: 0.4,
    powerModel: "generic",
    effectReal: true,
    truthText:
      "Treatment truly recovers ~65% vs ~45% for placebo — a real association.",
    teach:
      "Both variables are categorical (group × yes/no) → chi-square test of independence. A t-test needs a continuous outcome; 'recovered?' is a yes/no, so it does not apply.",
    simulate(n) {
      // n per arm
      let tr = [0, 0], ct = [0, 0]; // [recovered, not]
      for (let i = 0; i < n; i++) {
        bernoulli(0.65) ? tr[0]++ : tr[1]++;
        bernoulli(0.45) ? ct[0]++ : ct[1]++;
      }
      return { kind: "association", table: [tr, ct] };
    },
  },
  {
    id: "dose",
    skill: "logistic",
    hints: [
      "The outcome is yes/no; the predictor (dose) is a continuous number.",
      "Binary outcome predicted from a continuous predictor → logistic regression (keeps probabilities in 0–1).",
    ],
    title: "Dose vs side-effect",
    prompt:
      "Does a continuous DOSE predict whether a patient gets a side-effect (yes/no)?",
    dataNote: "Dose (continuous x) and side-effect (binary y) per patient.",
    classify: { outcome: "binary", groups: "predictor", paired: "independent" },
    method: "logistic",
    wrong: "linear",
    effect: 0.5,
    powerModel: "generic",
    effectReal: true,
    truthText:
      "Higher doses truly raise the probability of a side-effect (a real positive log-odds slope).",
    teach:
      "Binary outcome from a CONTINUOUS predictor → logistic regression. Linear regression would predict impossible probabilities below 0 and above 1; logistic keeps them in [0,1].",
    simulate(n) {
      const x = sampleNormal(n, 50, 15);
      const y = x.map((d) => {
        const logit = -5 + 0.1 * d; // real positive effect of dose
        const p = 1 / (1 + Math.exp(-logit));
        return bernoulli(p);
      });
      return { kind: "logistic", x, y };
    },
  },
];

// Human-readable labels for the method ids (the tree's solid boxes).
export const METHOD_LABELS = {
  t_test: "Two-sample t-test",
  paired_t: "Paired t-test",
  anova: "One-way ANOVA",
  linear: "Linear regression",
  chi_square: "Chi-square test",
  logistic: "Logistic regression",
};
