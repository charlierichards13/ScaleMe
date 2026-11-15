// FICTIONAL DEMO ONLY. No model, network, applicant data, storage or credentials.
import { EvidenceLedger } from "./ledger";
import type { Baseline, EvidenceReviewer, Requirement, Source } from "./types";

const portal = "Built an internal employee portal.";
const csv = "Worked on a CSV import tool.";
export const testingAnswer = "I tested login, navigation, and the mobile layout with coworkers before rollout.";
export const validationAnswer = "I added validation for missing fields and duplicate rows, and wrote error messages so users could correct their CSV files before importing.";
export const contradiction = "I did not test the portal before rollout.";

export function syntheticBaseline(): Baseline {
  return {
    requirements: [
      { id: "web", description: "Build web applications", importance: "required" },
      { id: "testing", description: "Experience testing web applications", importance: "required" },
      { id: "data", description: "Work on data import tools", importance: "required" },
      { id: "validation", description: "Validate imported data and explain errors", importance: "required" },
      { id: "automation", description: "Automate regression tests", importance: "preferred" },
    ],
    sources: [
      { id: "resume-portal", subjectId: "portal", kind: "resume", text: portal },
      { id: "resume-csv", subjectId: "csv", kind: "resume", text: csv },
    ],
    evidence: [
      { id: "portal-build", requirementId: "web", sourceId: "resume-portal",
        start: 0, end: portal.length, quote: portal, review: "candidate_reported", independentlyVerified: false },
      { id: "csv-work", requirementId: "data", sourceId: "resume-csv",
        start: 0, end: csv.length, quote: csv, review: "candidate_reported", independentlyVerified: false },
    ],
    assessments: [
      { requirementId: "web", status: "supported", evidenceIds: ["portal-build"] },
      { requirementId: "testing", status: "not_evidenced", evidenceIds: [] },
      { requirementId: "data", status: "supported", evidenceIds: ["csv-work"] },
      { requirementId: "validation", status: "not_evidenced", evidenceIds: [] },
      { requirementId: "automation", status: "not_evidenced", evidenceIds: [] },
    ],
  };
}

/** A deliberately narrow, manually reviewed policy. Full source + quote +
 * requirement description + subject must match. Unknown text stays unresolved,
 * including positive keywords with appended contradictions/instructions.
 * This is a deterministic backup, not general semantic or truth verification. */
export const syntheticReviewer: EvidenceReviewer = (requirement, source, evidence) => {
  const expected = syntheticBaseline().requirements.find((r) => r.id === requirement.id);
  if (!expected || requirement.description !== expected.description) return "unresolved";
  if (source.kind === "resume") {
    if (source.subjectId === "portal" && requirement.id === "web" &&
        source.text === portal && evidence.quote === portal) return "supports";
    if (source.subjectId === "csv" && requirement.id === "data" &&
        source.text === csv && evidence.quote === csv) return "supports";
  } else {
    if (source.subjectId === "portal" && requirement.id === "testing") {
      if (source.text === testingAnswer) return "supports";
      if (source.text === contradiction) return "contradicts";
    }
    if (source.subjectId === "csv" && requirement.id === "validation" &&
        source.text === validationAnswer) return "supports";
  }
  return "unresolved";
};

export function candidateAnswer(
  text: string, id = "turn-testing", targetRequirementId = "testing", subjectId = "portal",
): Extract<Source, { kind: "interview" }> {
  return { id, subjectId, kind: "interview", role: "candidate", targetRequirementId, text };
}

export function runSyntheticExample() {
  const initial = EvidenceLedger.create(syntheticBaseline(), syntheticReviewer);
  const tested = initial.reassess(candidateAnswer(testingAnswer));
  const after = tested.reassess(candidateAnswer(validationAnswer, "turn-validation", "validation", "csv"));
  const view = after.view();
  return {
    mode: "FICTIONAL DEMO — deterministic; no live AI" as const,
    ...view,
    testingTransition: {
      requirementId: "testing",
      before: view.before.find((a) => a.requirementId === "testing")!.status,
      after: view.after.find((a) => a.requirementId === "testing")!.status,
      sourceId: "turn-testing", quote: testingAnswer,
      review: "candidate_reported" as const, independentlyVerified: false as const,
    },
    afterTestingCoverage: tested.view().coverage.after,
    proposals: [
      after.proposeImpact("portal-build", "answer:turn-testing"),
      after.proposeImpact("csv-work", "answer:turn-validation"),
    ],
    strengths: view.coverage.after.supportedRequiredRequirementIds.map((id) =>
      view.requirements.find((r: Requirement) => r.id === id)!),
    gaps: view.after.filter((a) => a.status !== "supported").map((a) => a.requirementId),
    nextSteps: [
      "Review the proposed wording and exact sources before using it.",
      "If you have automated regression testing experience, provide a specific example; otherwise consider a practice project.",
      "Find measured outcome records before adding metrics; leave unknown results as questions.",
    ],
  };
}
