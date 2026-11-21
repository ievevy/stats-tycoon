// pipeline.js — a full "research project" run end to end for one concept:
// build the question → hypotheses → power → method → run → draw a conclusion.
// This is the vertical slice; more projects are mostly authoring on top of it.

import { sampleNormal, bernoulli } from "./stats.js";

export const PROJECTS = [
  {
    id: "drug-bp",
    title: "Does a drug beat a placebo?",
    goal: "Does a new blood-pressure drug beat a placebo? Design and run the whole study.",
    tiles: ["Does", "the new drug", "lower", "blood pressure", "compared to a placebo?"],
    distractors: ["by how much", "satisfaction"],
    designLabel: "two independent groups",
    outcome: "continuous",
    method: "t_test",
    skill: "independent-ttest",
    h0: "The drug and placebo groups have the same mean blood pressure.",
    h1: "The drug and placebo groups differ in mean blood pressure.",
    effect: 0.58,
    powerModel: "two",
    randomized: true, // a randomized experiment → a causal claim is allowed if significant
    truth: "In truth the drug lowers blood pressure by about 7 mmHg (SD ≈ 12).",
    caveats: [
      "This is ONE simulated study at your chosen sample size — evidence, not proof. Real findings need replication.",
      "It assumes the test's conditions hold: roughly normal data, independent observations, similar spread in each group.",
      "The result is about group AVERAGES — not every individual. Some patients may not respond at all.",
      "It generalises only to people like those sampled; a different population (age, health, country) may differ.",
      "A causal claim rests on proper randomization. Without it, you would only have an association, not a cause.",
    ],
    simulate(n) {
      const drug = sampleNormal(n, 123, 12);   // mean 123
      const placebo = sampleNormal(n, 130, 12); // mean 130 (a real 7-point gap)
      return { kind: "two", groups: [drug, placebo] };
    },
    // conclusions depend on whether the run came out significant
    sigConclusions: [
      { t: "The drug likely lowers blood pressure — and because this was a randomized experiment, that supports a causal effect.", ok: true, why: "A significant result in a randomized trial supports causation: randomization balances out confounders." },
      { t: "The drug is proven to lower blood pressure in everyone.", why: "Statistics gives evidence, not proof — and results describe averages, not every individual." },
      { t: "Nothing can be concluded from this study.", why: "A significant result in a well-run trial is real evidence." },
    ],
    nsConclusions: [
      { t: "No significant difference was found — but that isn't proof the drug does nothing, especially if the study was underpowered.", ok: true, why: "Non-significant ≠ no effect; too small a sample can miss a real effect." },
      { t: "The drug is proven to have no effect.", why: "Failing to detect an effect is not proof there is none." },
      { t: "The drug clearly works.", why: "You found no evidence it works, so you can't claim it does." },
    ],
  },

  {
    id: "training-pre-post",
    title: "Does training change scores?",
    goal: "Does a training course change the SAME students' test scores (before vs after)?",
    tiles: ["Do", "test scores", "change", "after the training", "for the same students?"],
    distractors: ["between two groups", "how often"],
    designLabel: "paired measurements (same people, twice)",
    outcome: "continuous",
    method: "paired_t",
    skill: "paired-ttest",
    h0: "Mean test scores are the same before and after training.",
    h1: "Mean test scores differ before and after training.",
    effect: 0.5,
    powerModel: "paired",
    randomized: false,
    truth: "Scores rise about 6 points on average after training (SD of the change ≈ 11).",
    simulate(n) {
      const before = sampleNormal(n, 500, 90);
      const after = before.map((b) => b + 6 + (Math.random() * 2 - 1) * 11);
      return { kind: "paired", before, after };
    },
    sigConclusions: [
      { t: "Scores improved significantly — but a before/after design has no control group, so you can't be sure the training (vs practice, time, or regression to the mean) caused it.", ok: true, why: "Pre/post without a control group can't isolate the cause — the honest claim is 'scores changed', not 'training caused it'." },
      { t: "The training definitely caused the improvement.", why: "No control group → practice, maturation, or regression to the mean aren't ruled out." },
      { t: "Nothing changed.", why: "A significant result is evidence of a change." },
    ],
    nsConclusions: [
      { t: "No significant change was detected — which isn't proof the training does nothing, especially if underpowered.", ok: true, why: "Non-significant ≠ no effect." },
      { t: "The training is proven useless.", why: "Failing to detect a change isn't proof there is none." },
      { t: "Scores definitely improved.", why: "You found no significant change." },
    ],
    caveats: [
      "One study at your sample size — evidence, not proof; replication matters.",
      "A paired t-test assumes the CHANGES are roughly normal and the pairs independent.",
      "A pre/post design has NO control group, so practice, time, or regression to the mean could explain the change — not just the training.",
      "Results are averages; individual students vary.",
      "Generalises only to students like those measured.",
    ],
  },

  {
    id: "treatment-recovery",
    title: "Is recovery linked to treatment?",
    goal: "In a randomized trial, is recovery (yes/no) associated with treatment vs control?",
    tiles: ["Is", "recovery", "associated with", "the treatment", "versus control?"],
    distractors: ["the average", "by how much"],
    designLabel: "two categories × two categories",
    outcome: "binary",
    method: "chi_square",
    skill: "chi-square",
    h0: "Recovery is independent of the treatment group.",
    h1: "Recovery depends on the treatment group.",
    effect: 0.42,
    powerModel: "generic",
    randomized: true,
    truth: "Treatment recovers ~65% vs ~45% on placebo — a real association.",
    simulate(n) {
      const tr = [0, 0], ct = [0, 0];
      for (let i = 0; i < n; i++) { bernoulli(0.65) ? tr[0]++ : tr[1]++; bernoulli(0.45) ? ct[0]++ : ct[1]++; }
      return { kind: "association", table: [tr, ct] };
    },
    sigConclusions: [
      { t: "Recovery is associated with treatment — and because this was randomized, that supports a causal effect.", ok: true, why: "A significant association in a randomized trial supports causation." },
      { t: "The treatment cures everyone.", why: "It raises the recovery RATE on average — not a guarantee for every patient." },
      { t: "There's no link.", why: "A significant result is evidence of one." },
    ],
    nsConclusions: [
      { t: "No significant association was found — not proof the treatment does nothing, especially if underpowered.", ok: true, why: "Non-significant ≠ no effect." },
      { t: "The treatment is proven ineffective.", why: "Absence of evidence isn't evidence of absence." },
      { t: "The treatment works.", why: "No significant association was found." },
    ],
    caveats: [
      "One trial at your sample size — replication strengthens confidence.",
      "Chi-square needs adequate expected counts per cell (use Fisher's exact if tiny).",
      "It shows a rate difference on AVERAGE, not a guarantee per person.",
      "Generalises only to patients like those enrolled.",
      "The causal claim depends on proper randomization and few dropouts.",
    ],
  },

  {
    id: "hours-score",
    title: "Do study hours predict scores?",
    goal: "In observed data, does the number of hours studied predict exam score?",
    tiles: ["Does", "the number of hours studied", "predict", "exam score?"],
    distractors: ["which group", "yes or no"],
    designLabel: "a continuous predictor → a continuous outcome",
    outcome: "continuous",
    method: "linear",
    skill: "linear",
    h0: "Hours studied has no linear relationship with exam score (slope = 0).",
    h1: "Hours studied predicts exam score (slope ≠ 0).",
    effect: 0.45,
    powerModel: "generic",
    randomized: false,
    truth: "Each extra hour is linked to about +4 points on average (with scatter).",
    simulate(n) {
      const x = sampleNormal(n, 10, 3);
      const y = x.map((h) => 40 + 4 * h + (Math.random() * 2 - 1) * 18);
      return { kind: "regression", x, y };
    },
    sigConclusions: [
      { t: "Hours studied predicts score — but this is OBSERVATIONAL, so you can't claim studying CAUSES higher scores (ability or motivation could drive both).", ok: true, why: "A significant slope shows association; without an experiment, confounders aren't ruled out." },
      { t: "Studying more causes higher scores.", why: "Observational data can't establish causation — a confounder (e.g., ability) may drive both." },
      { t: "There's no relationship.", why: "A significant slope is evidence of one." },
    ],
    nsConclusions: [
      { t: "No significant relationship was detected — not proof there is none, especially if underpowered or the range of hours was narrow.", ok: true, why: "Non-significant ≠ no relationship." },
      { t: "Hours and scores are proven unrelated.", why: "Absence of evidence isn't evidence of absence." },
      { t: "More hours clearly raise scores.", why: "You found no significant relationship." },
    ],
    caveats: [
      "One sample — the slope estimate has uncertainty; replication helps.",
      "Linear regression assumes a roughly linear relationship, independent points, and fairly constant scatter.",
      "OBSERVATIONAL data → association only; a confounder could explain the link.",
      "The relationship may not hold outside the range of hours observed.",
      "Describes an average trend, not every student.",
    ],
  },

  {
    id: "dose-sideeffect",
    title: "Does dose raise side-effect risk?",
    goal: "In a dose-ranging trial, does a higher assigned dose raise the chance of a side-effect?",
    tiles: ["Does", "a higher dose", "increase the chance of", "a side-effect?"],
    distractors: ["the average", "three groups"],
    designLabel: "a continuous predictor → a binary outcome",
    outcome: "binary",
    method: "logistic",
    skill: "logistic",
    h0: "Dose has no effect on the probability of a side-effect.",
    h1: "A higher dose changes the probability of a side-effect.",
    effect: 0.5,
    powerModel: "generic",
    randomized: true,
    truth: "Higher doses truly raise the probability of a side-effect (a real positive log-odds slope).",
    simulate(n) {
      const x = sampleNormal(n, 50, 15);
      const y = x.map((d) => bernoulli(1 / (1 + Math.exp(-(-5 + 0.1 * d)))));
      return { kind: "logistic", x, y };
    },
    sigConclusions: [
      { t: "Higher dose raises side-effect risk — and since dose was assigned (randomized), that supports a causal, dose-dependent effect.", ok: true, why: "A significant slope in a randomized dose trial supports causation." },
      { t: "Every patient on a high dose will get a side-effect.", why: "It raises the PROBABILITY on average — not a certainty for each person." },
      { t: "Dose has no effect.", why: "A significant slope is evidence it does." },
    ],
    nsConclusions: [
      { t: "No significant dose effect was detected — not proof there is none, especially if underpowered.", ok: true, why: "Non-significant ≠ no effect." },
      { t: "Dose is proven safe at any level.", why: "Absence of evidence isn't evidence of absence." },
      { t: "Higher doses clearly cause side-effects.", why: "You found no significant effect." },
    ],
    caveats: [
      "One trial at your sample size — replication strengthens confidence.",
      "Logistic regression assumes the log-odds change roughly linearly with dose, with independent observations.",
      "It estimates a probability trend on AVERAGE, not a guarantee per patient.",
      "Generalises only to patients and doses like those studied.",
      "The causal, dose-dependent claim rests on doses being properly assigned.",
    ],
  },
];
