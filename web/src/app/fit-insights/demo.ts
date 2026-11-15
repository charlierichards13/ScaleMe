/** Fixed fictional fixtures, not API types or a general-purpose evidence classifier. */
export type Status = "supported" | "unclear" | "not_evidenced";
export type Phase = "before" | "after";
export type Answer = "relevant" | "vague" | "irrelevant";
export type Citation = { sourceId: string; quote: string };
export const sources = {
  "resume-project": {
    kind: "resume",
    label: "Resume · Projects",
    text: "Built an internal employee portal using React and TypeScript.",
  },
  "resume-team": {
    kind: "resume",
    label: "Resume · Collaboration",
    text: "Worked with coworkers to gather feedback on the portal.",
  },
  "turn-testing": {
    kind: "interview",
    label: "Interview · Candidate answer 01",
    text: "I tested login, navigation, and the mobile layout with coworkers before rollout.",
  },
  "turn-vague": {
    kind: "interview",
    label: "Interview · Vague sample",
    text: "I made sure it worked well.",
  },
  "turn-irrelevant": {
    kind: "interview",
    label: "Interview · Unrelated sample",
    text: "I enjoyed choosing the colors for the portal.",
  },
} as const;
export const answers: Record<
  Answer,
  { sourceId: keyof typeof sources; label: string }
> = {
  relevant: { sourceId: "turn-testing", label: "Specific testing answer" },
  vague: { sourceId: "turn-vague", label: "Vague answer" },
  irrelevant: { sourceId: "turn-irrelevant", label: "Unrelated answer" },
};
export type Requirement = {
  id: string;
  title: string;
  importance: "required" | "preferred";
  jobQuote: string;
  baseline: Status;
  citation?: Citation;
  why: string;
  question: string;
  next: string;
};
export const requirements: readonly Requirement[] = [
  {
    id: "web",
    title: "Build web applications",
    importance: "required",
    jobQuote: "Experience building web applications with React and TypeScript.",
    baseline: "supported",
    citation: {
      sourceId: "resume-project",
      quote: sources["resume-project"].text,
    },
    why: "The resume names a web application and both requested technologies.",
    question: "What did you personally build in the portal?",
    next: "Prepare a concrete walkthrough of your own contribution.",
  },
  {
    id: "collaboration",
    title: "Collaborate with colleagues",
    importance: "required",
    jobQuote: "Collaborate with colleagues and incorporate their feedback.",
    baseline: "supported",
    citation: { sourceId: "resume-team", quote: sources["resume-team"].text },
    why: "The resume explicitly describes gathering feedback from coworkers.",
    question: "Which feedback led you to change the portal?",
    next: "Prepare a specific example of responding to feedback.",
  },
  {
    id: "testing",
    title: "Test web applications",
    importance: "required",
    jobQuote: "Experience testing web applications before rollout.",
    baseline: "not_evidenced",
    why: "The resume describes building the portal, but says nothing about testing it.",
    question: "How did you test the portal before colleagues started using it?",
    next: "Ask for the checks performed, what was tested, and who was involved. Do not assume tools or outcomes.",
  },
  {
    id: "feedback",
    title: "Turn feedback into improvements",
    importance: "required",
    jobQuote: "Use feedback to make concrete product improvements.",
    baseline: "unclear",
    citation: { sourceId: "resume-team", quote: sources["resume-team"].text },
    why: "Gathering feedback is described; a resulting product change is not.",
    question:
      "What specific change did you make after receiving coworker feedback?",
    next: "Capture the change and your contribution. Leave impact metrics unknown unless supplied.",
  },
  {
    id: "automation",
    title: "Automate regression checks",
    importance: "preferred",
    jobQuote: "Familiarity with automated regression testing is a plus.",
    baseline: "not_evidenced",
    why: "Neither the resume nor the sample answer mentions automated tests.",
    question:
      "Have you written automated regression tests? If so, what did they check?",
    next: "If you have an example, describe it accurately. Otherwise, consider a small practice project.",
  },
];
export const requiredIds = Object.freeze(
  requirements.filter((r) => r.importance === "required").map((r) => r.id),
);
const testingCitation: Citation = {
  sourceId: "turn-testing",
  quote: sources["turn-testing"].text,
};

/** Explicit, manually reviewed links. Exact text alone never establishes relevance. */
export function validCitation(
  requirementId: string,
  citation: Citation,
  answerShown: boolean,
): boolean {
  if (!Object.hasOwn(sources, citation.sourceId)) return false;
  const source = sources[citation.sourceId as keyof typeof sources];
  if (
    !source ||
    !citation.quote.trim() ||
    !source.text.includes(citation.quote)
  )
    return false;
  if (source.kind === "interview" && !answerShown) return false;
  const approved = requirements.find((r) => r.id === requirementId)?.citation;
  return (
    (approved?.sourceId === citation.sourceId &&
      approved.quote === citation.quote) ||
    (requirementId === "testing" &&
      citation.sourceId === testingCitation.sourceId &&
      citation.quote === testingCitation.quote)
  );
}
export function assessment(
  id: string,
  phase: Phase,
  shownAnswer?: Answer,
): { status: Status; citation?: Citation } {
  const requirement = requirements.find((r) => r.id === id);
  if (!requirement) return { status: "not_evidenced" };
  if (
    id === "testing" &&
    phase === "after" &&
    shownAnswer === "relevant" &&
    validCitation(id, testingCitation, true)
  ) {
    return { status: "supported", citation: testingCitation };
  }
  const citation =
    requirement.citation && validCitation(id, requirement.citation, false)
      ? requirement.citation
      : undefined;
  return {
    status:
      requirement.baseline === "supported" && !citation
        ? "not_evidenced"
        : requirement.baseline,
    citation,
  };
}
export function coverage(
  phase: Phase,
  shownAnswer?: Answer,
  ids: readonly string[] = requiredIds,
) {
  if (
    ids.length !== requiredIds.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !requiredIds.includes(id))
  ) {
    throw new Error("Requirement inventory changed; comparison unavailable.");
  }
  return {
    supported: ids.filter(
      (id) => assessment(id, phase, shownAnswer).status === "supported",
    ).length,
    total: ids.length,
  };
}
export function selectRequirement(id: string): Requirement | undefined {
  return requirements.find((r) => r.id === id);
}
export const statusLabels: Record<Status, string> = {
  supported: "Supported",
  unclear: "Unclear",
  not_evidenced: "Not evidenced",
};
