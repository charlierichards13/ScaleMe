import {
  AnswerSchema, AssessmentsSchema, BaselineSchema, InventorySchema,
  type Assessment, type Baseline, type CandidateEvidence, type Coverage,
  type EvidenceReviewer, type ImpactProposal, type LedgerView, type Requirement,
  type Source,
} from "./types";

export class LedgerValidationError extends Error {
  constructor() {
    // Never echo candidate input, raw Zod errors or a reviewer's exception.
    super("Evidence ledger input or provenance is invalid.");
    this.name = "LedgerValidationError";
  }
}
function ensure(condition: unknown): asserts condition {
  if (!condition) throw new LedgerValidationError();
}
function parse<T>(schema: { safeParse: (input: unknown) =>
  { success: true; data: T } | { success: false } }, input: unknown): T {
  const result = schema.safeParse(input);
  ensure(result.success);
  return result.data;
}
function unique(ids: string[]) { ensure(new Set(ids).size === ids.length); }
function checkAssessments(requirements: Requirement[], assessments: Assessment[]) {
  unique(assessments.map((a) => a.requirementId));
  ensure(assessments.length === requirements.length);
  ensure(requirements.every((r) => assessments.some((a) => a.requirementId === r.id)));
  assessments.forEach((a) => unique(a.evidenceIds));
}

/** Counts have no model-supplied numerator or denominator. Order is canonicalized
 * by inventory, and ALL IDs/descriptions/importance must remain identical. */
export function compareCoverage(
  beforeInventory: unknown, beforeAssessments: unknown,
  afterInventory: unknown, afterAssessments: unknown,
): { before: Coverage; after: Coverage } {
  const initial = parse(InventorySchema, beforeInventory);
  const final = parse(InventorySchema, afterInventory);
  unique(initial.map((r) => r.id));
  unique(final.map((r) => r.id));
  ensure(initial.length === final.length);
  ensure(initial.every((r) => {
    const other = final.find((item) => item.id === r.id);
    return other?.description === r.description && other.importance === r.importance;
  }));
  const before = parse(AssessmentsSchema, beforeAssessments);
  const after = parse(AssessmentsSchema, afterAssessments);
  checkAssessments(initial, before);
  checkAssessments(initial, after);
  const count = (assessments: Assessment[]): Coverage => {
    const requiredRequirementIds = initial.filter((r) => r.importance === "required").map((r) => r.id);
    const supportedRequiredRequirementIds = requiredRequirementIds.filter((id) =>
      assessments.some((a) => a.requirementId === id && a.status === "supported"));
    return { requiredRequirementIds, supportedRequiredRequirementIds,
      supported: supportedRequiredRequirementIds.length, total: requiredRequirementIds.length };
  };
  return { before: count(before), after: count(after) };
}

function decision(reviewer: EvidenceReviewer, r: Requirement, s: Source, e: CandidateEvidence) {
  try {
    // Give trusted reviewers copies so a buggy reviewer cannot mutate our state.
    const value = reviewer(structuredClone(r), structuredClone(s), structuredClone(e));
    ensure(["supports", "contradicts", "unresolved"].includes(value));
    return value;
  } catch { throw new LedgerValidationError(); }
}
function validate(data: Baseline, reviewer: EvidenceReviewer) {
  unique(data.requirements.map((r) => r.id));
  unique(data.sources.map((s) => s.id));
  unique(data.evidence.map((e) => e.id));
  checkAssessments(data.requirements, data.assessments);
  ensure(data.sources.filter((s) => s.kind === "interview").length <= 20);
  for (const source of data.sources) {
    if (source.kind === "interview")
      ensure(data.requirements.some((r) => r.id === source.targetRequirementId));
  }
  for (const evidence of data.evidence) {
    const source = data.sources.find((s) => s.id === evidence.sourceId);
    ensure(source && data.requirements.some((r) => r.id === evidence.requirementId));
    ensure(evidence.end <= source.text.length && evidence.start < evidence.end);
    ensure(source.text.slice(evidence.start, evidence.end) === evidence.quote);
    if (source.kind === "interview") {
      ensure(source.targetRequirementId === evidence.requirementId);
      // Capture whole answers, including caveats, negations and instructions.
      ensure(evidence.start === 0 && evidence.end === source.text.length);
    }
  }
  for (const assessment of data.assessments) {
    const requirement = data.requirements.find((r) => r.id === assessment.requirementId)!;
    const outcomes = assessment.evidenceIds.map((id) => {
      const evidence = data.evidence.find((e) => e.id === id);
      ensure(evidence && evidence.requirementId === requirement.id);
      return decision(reviewer, requirement,
        data.sources.find((s) => s.id === evidence.sourceId)!, evidence);
    });
    if (assessment.status === "supported") {
      ensure(outcomes.includes("supports") && !outcomes.includes("contradicts"));
    }
  }
}

/** Ephemeral immutable session: all operations return a new ledger or a copy.
 * Do not accept a serialized browser ledger as an authoritative baseline. */
export class EvidenceLedger {
  private constructor(
    private readonly data: Baseline,
    private readonly before: Assessment[],
    private readonly reviewer: EvidenceReviewer,
  ) {}

  static create(input: unknown, reviewer: EvidenceReviewer): EvidenceLedger {
    const data = parse(BaselineSchema, input);
    ensure(data.sources.every((s) => s.kind === "resume"));
    validate(data, reviewer);
    return new EvidenceLedger(data, structuredClone(data.assessments), reviewer);
  }

  view(): LedgerView {
    return structuredClone({
      requirements: this.data.requirements, sources: this.data.sources,
      evidence: this.data.evidence, before: this.before, after: this.data.assessments,
      coverage: compareCoverage(this.data.requirements, this.before,
        this.data.requirements, this.data.assessments),
    });
  }

  reassess(input: unknown): EvidenceLedger {
    const answer = parse(AnswerSchema, input);
    const data = structuredClone(this.data);
    ensure(!data.sources.some((s) => s.id === answer.id));
    const requirement = data.requirements.find((r) => r.id === answer.targetRequirementId);
    ensure(requirement);
    ensure(data.sources.some((s) => s.kind === "resume" && s.subjectId === answer.subjectId));
    const evidence: CandidateEvidence = {
      id: `answer:${answer.id}`, requirementId: requirement.id, sourceId: answer.id,
      start: 0, end: answer.text.length, quote: answer.text,
      review: "candidate_reported", independentlyVerified: false,
    };
    ensure(!data.evidence.some((e) => e.id === evidence.id));
    data.sources.push(answer);
    data.evidence.push(evidence);
    const result = decision(this.reviewer, requirement, answer, evidence);
    const assessment = data.assessments.find((a) => a.requirementId === requirement.id)!;
    assessment.evidenceIds.push(evidence.id);
    const hasContradiction = assessment.evidenceIds.some((id) => {
      const e = data.evidence.find((item) => item.id === id)!;
      return decision(this.reviewer, requirement,
        data.sources.find((s) => s.id === e.sourceId)!, e) === "contradicts";
    });
    // Contradictions remain unresolved even if another turn is positive.
    if (hasContradiction) assessment.status = "unclear";
    else if (result === "supports") assessment.status = "supported";
    const bounded = parse(BaselineSchema, data);
    validate(bounded, this.reviewer);
    return new EvidenceLedger(bounded, structuredClone(this.before), this.reviewer);
  }

  /** Extractive backup: join exact, reviewed candidate sentences. No free-form
   * model prose or ungrounded paraphrase is accepted as a factual proposal. */
  proposeImpact(originalEvidenceId: string, answerEvidenceId: string): ImpactProposal {
    const original = this.data.evidence.find((e) => e.id === originalEvidenceId);
    const answer = this.data.evidence.find((e) => e.id === answerEvidenceId);
    ensure(original && answer);
    const source = (e: CandidateEvidence) => this.data.sources.find((s) => s.id === e.sourceId)!;
    ensure(source(original).kind === "resume" && source(answer).kind === "interview");
    ensure(source(original).subjectId === source(answer).subjectId);
    for (const evidence of [original, answer]) {
      const requirement = this.data.requirements.find((r) => r.id === evidence.requirementId)!;
      ensure(decision(this.reviewer, requirement, source(evidence), evidence) === "supports");
      ensure(this.data.assessments.find((a) => a.requirementId === requirement.id)?.status === "supported");
    }
    return structuredClone({
      original: original.quote,
      improved: `${original.quote} ${answer.quote}`,
      supportingEvidence: [original, answer],
      reviewStatus: [original, answer].every((e) => e.review === "candidate_confirmed")
        ? "candidate_confirmed" as const : "ready_for_candidate_review" as const,
      independentlyVerified: false as const,
      followUpQuestions: [
        "What outcome did this work produce, and what source supports it?",
        "Do you have measured results and the records behind them? Leave metrics out if unknown.",
      ],
    });
  }
  /** Recompute from authoritative evidence; never trust a caller's proposal. */
  isGroundedWording(originalId: string, answerId: string, wording: unknown): boolean {
    return typeof wording === "string" && wording === this.proposeImpact(originalId, answerId).improved;
  }

  reviewEvidence(id: string, confirmed: boolean): EvidenceLedger {
    ensure(typeof confirmed === "boolean");
    const data = structuredClone(this.data);
    const evidence = data.evidence.find((e) => e.id === id);
    ensure(evidence);
    evidence.review = confirmed ? "candidate_confirmed" : "candidate_reported";
    return new EvidenceLedger(data, structuredClone(this.before), this.reviewer);
  }

  copyableImpact(originalId: string, answerId: string): string | null {
    const proposal = this.proposeImpact(originalId, answerId);
    return proposal.reviewStatus === "candidate_confirmed" ? proposal.improved : null;
  }
}
