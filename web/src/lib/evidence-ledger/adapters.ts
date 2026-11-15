import {
  FitAnalysisSchema, FitRequestSchema, type FitAnalysis, type FitRequest,
} from "../ai/schemas";
import { EvidenceLedger, LedgerValidationError } from "./ledger";
import { conservativeReviewer } from "./review";
import { InventorySchema, type Baseline, type Requirement } from "./types";

const invalid = (): never => { throw new LedgerValidationError(); };

/** Existing v0.1 fit adapter. Exact requirement inventory is mandatory because
 * FitAnalysis assessments alone contain neither descriptions nor importance.
 * Never infer required importance from array position or manufacture missing IDs.
 * Job quotes may describe requirements, but are excluded from candidate support.
 * A normalized fit quote must be resolved to an exact source span upstream. */
export function fromFitAnalysis(requestInput: unknown, analysisInput: unknown): EvidenceLedger {
  const parsed = FitRequestSchema.safeParse(requestInput);
  const fit = FitAnalysisSchema.safeParse(analysisInput);
  if (!parsed.success || !fit.success) return invalid();
  const request = parsed.data;
  const rawResume = (requestInput as FitRequest).resume.text;
  if (rawResume.length > 30_000) return invalid();
  request.resume.text = rawResume;
  const inventory = InventorySchema.safeParse(request.job.requirements);
  if (!inventory.success) return invalid();
  const requirements = inventory.data;
  const data: Baseline = { requirements, sources: [], evidence: [], assessments: [] };
  // Keep the full original source and exact offsets. A span-specific subject ID
  // lets the caller explicitly associate an answer with the selected original.
  for (const assessment of fit.data.assessments) {
    if (!requirements.some((r) => r.id === assessment.requirementId)) return invalid();
    const evidenceIds: string[] = [];
    for (const [index, quote] of assessment.evidence.entries()) {
      if (quote.source === "job") continue;
      if (quote.source !== "resume") return invalid();
      const start = request.resume.text.indexOf(quote.quote);
      if (start < 0 || request.resume.text.indexOf(quote.quote, start + 1) >= 0) return invalid();
      const sourceId = `resume-span-${start}-${start + quote.quote.length}`;
      if (!data.sources.some((s) => s.id === sourceId)) {
        data.sources.push({ id: sourceId, subjectId: sourceId, kind: "resume", text: request.resume.text });
      }
      const id = `baseline-${assessment.requirementId}-${index}`;
      const evidence = {
        id, requirementId: assessment.requirementId, sourceId, start,
        end: start + quote.quote.length, quote: quote.quote,
        review: "candidate_reported" as const, independentlyVerified: false as const,
      };
      data.evidence.push(evidence);
      evidenceIds.push(id);
    }
    const outcomes = evidenceIds.map((id) => {
      const evidence = data.evidence.find((e) => e.id === id)!;
      return conservativeReviewer(requirements.find((r) => r.id === assessment.requirementId)!,
        data.sources.find((s) => s.id === evidence.sourceId)!, evidence);
    });
    const supported = outcomes.includes("supports") && !outcomes.includes("contradicts");
    data.assessments.push({ requirementId: assessment.requirementId,
      status: assessment.status === "supported" && !supported ? "unclear" : assessment.status,
      evidenceIds });
  }
  // Resumes with no candidate citations still need a source to target an answer.
  if (!data.sources.length) data.sources.push({
    id: "resume-input", subjectId: "resume-input", kind: "resume", text: request.resume.text,
  });
  return EvidenceLedger.create(data, conservativeReviewer);
}

/** Local fallback for arbitrary pasted input, not Bedrock analysis. Keep each
 * requirement line intact and let the user choose importance before freezing it.
 * These IDs are assigned once by position and never regenerated on reassessment. */
export function requirementLines(description: unknown): Requirement[] {
  if (typeof description !== "string" || !description.trim() || description.length > 20_000) return invalid();
  const lines = description.split(/\n|;|(?<=[.!?])\s+/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
  const inventory = InventorySchema.safeParse(lines.map((line, index) => ({
    id: `r${index + 1}`, description: line,
    importance: /\b(preferred|nice to have|bonus|plus)\b/i.test(line) ? "preferred" :
      /\b(required|must|requirements)\b/i.test(line) ? "required" : "unspecified",
  })));
  return inventory.success ? inventory.data : invalid();
}

export function analyzeLocally(resumeText: string, jobText: string, requirements: Requirement[]) {
  const parsed = FitRequestSchema.safeParse({
    resume: { id: "resume-input", text: resumeText },
    job: { id: "job-input", title: "Target role", text: jobText, requirements },
  });
  if (!parsed.success) return invalid();
  const request = parsed.data;
  const inventory = InventorySchema.safeParse(request.job.requirements);
  if (!inventory.success) return invalid();
  if (resumeText.length > 30_000 || jobText.length > 20_000) return invalid();
  request.resume.text = resumeText;
  request.job.text = jobText;
  // Work on exact spans; never trim or normalize a cited sentence.
  const spans = request.resume.text.split(/\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((span) => span.trim()).filter((span) => span.length > 0 && span.length <= 500);
  const analysis: FitAnalysis = {
    summary: "Local conservative text assessment; no AI or independent verification.",
    assessments: inventory.data.map((r) => {
      const reviewed = spans.map((quote) => ({ quote, decision: conservativeReviewer(r,
        { id: "resume-input", subjectId: "resume-input", kind: "resume", text: request.resume.text },
        { id: "probe", requirementId: r.id, sourceId: "resume-input", start: 0, end: quote.length,
          quote, review: "candidate_reported", independentlyVerified: false }) }));
      const positive = reviewed.some((item) => item.decision === "supports");
      const negative = reviewed.some((item) => item.decision === "contradicts");
      const quotes = reviewed.filter((item) => item.decision !== "unresolved").slice(0, 5).map((item) => item.quote);
      return { requirementId: r.id, status: negative ? "unclear" : positive ? "supported" : "not_evidenced",
        explanation: negative ? "Candidate text includes a relevant negation; clarify it before claiming support." :
          positive ? "Specific candidate text matches this requirement under the local lexical policy." :
          "No specific matching evidence found by the conservative local policy; this does not mean you lack the skill.",
        evidence: quotes.map((quote) => ({ source: "resume" as const, quote })) };
    }),
    strengths: [], clarificationQuestions: [], growthSuggestions: [],
    disclaimer: "Documented evidence coverage is not a hiring probability. Candidate reports are not independently verified.",
  };
  return { request, analysis, ledger: fromFitAnalysis(request, analysis) };
}

/** Stable turn and requirement IDs must be supplied by the calling session.
 * v0.1 InterviewTurn has no IDs/target, so never guess these from history index. */
export function fromCandidateTurn(turn: {
  id: string; role: "candidate"; content: string; targetRequirementId: string; subjectId: string;
}) {
  return { id: turn.id, kind: "interview" as const, role: turn.role,
    text: turn.content, targetRequirementId: turn.targetRequirementId, subjectId: turn.subjectId };
}

export type FitHandoff = { request: FitRequest; analysis: FitAnalysis };
