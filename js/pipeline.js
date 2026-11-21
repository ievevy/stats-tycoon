// pipeline.js — a full "research project" run end to end for one concept:
// build the question → hypotheses → power → method → run → draw a conclusion.
// This is the vertical slice; more projects are mostly authoring on top of it.

import { sampleNormal } from "./stats.js";

export const PROJECTS = [
  {
    id: "drug-bp",
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
];
