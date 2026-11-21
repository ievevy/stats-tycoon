// levels.js — the career ladder. Each playable level is a chapter with a story,
// a rank, and the studies you must handle to earn your promotion. Higher ranks
// stay locked until you pass the one before. Beyond the playable ranks are
// aspirational "coming soon" ranks that double as the roadmap.

export const levels = [
  {
    id: "foundations",
    chapter: "Orientation",
    rank: "Foundations",
    icon: "🧭",
    story:
      "Before you touch real data, the PI sits you down for orientation. Get the core ideas straight — what a p-value is, what an effect size tells you, and how to check that raters agree — and the rest of your career will make sense.",
    teaches: "p-values, effect size, and rater agreement.",
    scenarioIds: [],
    isFoundation: true,
  },
  {
    id: "intern",
    chapter: "Chapter 1",
    rank: "Lab Intern",
    icon: "🧫",
    story:
      "Day one. The coffee is bad and the PI already handed you two datasets. Comparing two groups is where every researcher starts — get the t-test family right and you're on your way.",
    teaches: "Two-group comparisons: independent vs paired t-tests.",
    scenarioIds: ["two-methods", "tutoring", "diet-two"],
  },
  {
    id: "ra",
    chapter: "Chapter 2",
    rank: "Research Assistant",
    icon: "🔬",
    story:
      "You've earned a badge and a desk. Now the questions have more moving parts — three groups at once, and relationships between numbers. Time for ANOVA and regression.",
    teaches: "More than two groups, and continuous predictors.",
    scenarioIds: ["fertilizer", "study-hours", "classes-anova"],
  },
  {
    id: "phd",
    chapter: "Chapter 3",
    rank: "PhD Candidate",
    icon: "🎓",
    story:
      "Your thesis needs categorical outcomes — recoveries, yes/no events, risks. These don't fit a t-test at all. Master the chi-square and logistic regression and the committee will be impressed.",
    teaches: "Categorical and binary outcomes.",
    scenarioIds: ["treatment", "dose", "vaccine-chi"],
  },
  {
    id: "pi",
    chapter: "Chapter 4",
    rank: "Principal Investigator",
    icon: "🏆",
    story:
      "You run the lab now. Grant reviewers send a mixed stack of studies and expect the right method on every one — no warm-up, no hints. Prove you can pick from the whole tree.",
    teaches: "The full gauntlet: every method, shuffled.",
    scenarioIds: "ALL",
  },
];

// Ranks you can see but not yet play — the aspiration (and the roadmap).
export const lockedRanks = [
  { rank: "Department Head", icon: "🏛️", note: "Multinomial & mixed models — coming soon" },
  { rank: "Nobel Laureate", icon: "🥇", note: "Prediction, RL & the pitfalls — coming soon" },
];

// Score a single study, 0–100.
export function scoreStudy({ correctMethod, correctClassify, sig, powered, effectReal }) {
  let s = 0;
  if (correctMethod) s += 60;
  if (correctClassify) s += 20;
  if (correctMethod) {
    if (sig && effectReal) s += 20;
    else if (powered) s += 10;
  }
  return Math.max(0, Math.min(100, s));
}

// Stars for a level average.
export function starsFor(avg) {
  if (avg >= 90) return 3;
  if (avg >= 72) return 2;
  if (avg >= 55) return 1;
  return 0;
}

export const PASS_MARK = 55;
