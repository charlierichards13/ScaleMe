// FICTIONAL DEMO fixtures and local view state. These are not API contracts.
export type Review = "reported" | "confirmed" | "rejected";
export type Reviews = Readonly<Record<string, Review>>;

export const sources = {
  "resume-portal": { label: "Resume · project 1", text: "Built an internal employee portal." },
  "answer-portal": { label: "Interview · answer 1", text: "I built the resource navigation and tested login, navigation, and the mobile layout with coworkers before rollout." },
  "resume-import": { label: "Resume · project 2", text: "Worked on a CSV import tool." },
  "answer-import": { label: "Interview · answer 2", text: "I added validation for missing fields and duplicate rows, and wrote error messages so users could correct their CSV files before importing." },
} as const;

export const evidence = [
  { id: "portal-build", source: "resume-portal", quote: "Built an internal employee portal.", claim: "Built the portal" },
  { id: "portal-test", source: "answer-portal", quote: sources["answer-portal"].text, claim: "Owned navigation and tested with coworkers" },
  { id: "import-work", source: "resume-import", quote: "Worked on a CSV import tool.", claim: "Contributed to the import tool" },
  { id: "import-validation", source: "answer-import", quote: sources["answer-import"].text, claim: "Added validation and actionable errors" },
] as const;

export const suggestions = [
  {
    id: "portal", title: "Internal employee portal", focus: "Make your contribution visible",
    original: sources["resume-portal"].text,
    improved: "Built an internal employee portal, including resource navigation, and tested login, navigation, and the mobile layout with coworkers before rollout.",
    evidenceIds: ["portal-build", "portal-test"],
    strength: "Navigation ownership and testing details make this experience more specific.",
    missing: "Adoption, time saved, and business outcomes were not provided. No metrics are added.",
    next: "Look for rollout feedback or usage records before making an adoption or time-saving claim.",
    questions: [
      { topic: "Personal contribution", question: "Which parts of the portal did you build yourself, and which belonged to teammates?" },
      { topic: "Engineering decisions", question: "Why did you choose this navigation structure over the alternatives?" },
      { topic: "Technical challenges", question: "What failed during login or mobile testing, and how did you diagnose it?" },
      { topic: "Measurable outcomes", question: "Do you have usage records or a measured before/after task time? If not, what feedback can you cite?" },
      { topic: "Business impact", question: "What work did the portal help coworkers complete, and who can corroborate that?" },
    ],
  },
  {
    id: "import", title: "CSV import tool", focus: "Explain the engineering behind the task",
    original: sources["resume-import"].text,
    improved: "Added validation for missing fields and duplicate rows to a CSV import tool, with error messages to help users correct files before importing.",
    evidenceIds: ["import-work", "import-validation"],
    strength: "Validation behavior and error recovery explain what the candidate contributed.",
    missing: "Error reduction, import volume, and support impact were not provided. No metrics are added.",
    next: "Find a test case or issue record demonstrating the validation; measure import failures before claiming a reduction.",
    questions: [
      { topic: "Personal contribution", question: "Did you implement the validation logic, the error interface, or both? What did teammates own?" },
      { topic: "Engineering decisions", question: "Why validate before importing rather than rejecting rows after they were saved?" },
      { topic: "Technical challenges", question: "How did you detect duplicate rows, and what edge cases were difficult?" },
      { topic: "Measurable outcomes", question: "Were import failures measured before and after your change? What records support that comparison?" },
      { topic: "Business impact", question: "What happened when a file failed before this change, and whose workflow did you aim to help?" },
    ],
  },
] as const;

export type Suggestion = (typeof suggestions)[number];

export function initialReviews(): Reviews {
  return Object.fromEntries(evidence.map(({ id }) => [id, "reported"]));
}

export function reviewEvidence(reviews: Reviews, id: string, review: Review): Reviews {
  if (!evidence.some((item) => item.id === id)) return reviews;
  return { ...reviews, [id]: review };
}

export function suggestionStatus(suggestion: Suggestion, reviews: Reviews) {
  // Fail closed for missing IDs and quotes. This guard only handles fixed fixtures;
  // it is not a general fact checker or validator for future model output.
  const linked = suggestion.evidenceIds.map((id) => evidence.find((item) => item.id === id));
  if (!linked.length || linked.some((item) => !item || !sources[item.source].text.includes(item.quote))) return "blocked";
  if (linked.some((item) => reviews[item!.id] === "rejected")) return "blocked";
  return linked.every((item) => reviews[item!.id] === "confirmed") ? "ready" : "review";
}

export function copyableBullet(suggestion: Suggestion, reviews: Reviews): string | null {
  return suggestionStatus(suggestion, reviews) === "ready" ? suggestion.improved : null;
}
