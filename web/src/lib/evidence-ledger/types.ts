import { z } from "zod";
import { JobPostingSchema, RequirementAssessmentSchema } from "../ai/schemas";

// Internal domain types, NOT an adopted v0.2 HTTP contract.
export const RequirementSchema = JobPostingSchema.shape.requirements.unwrap().element.strict()
  .refine((r) => r.id.trim() === r.id && r.id.length > 0 && r.description.trim().length > 0);
const id = z.string().min(1).max(100).refine((s) => s.trim() === s);
const text = z.string().min(1).max(30_000).refine((s) => s.trim().length > 0);
export const SourceSchema = z.discriminatedUnion("kind", [
  z.object({ id, subjectId: id, kind: z.literal("resume"), text }).strict(),
  z.object({
    id, subjectId: id, kind: z.literal("interview"), role: z.literal("candidate"),
    targetRequirementId: id, text: text.max(4_000),
  }).strict(),
]);
export const EvidenceSchema = z.object({
  id: z.string().min(1).max(128), requirementId: id, sourceId: id,
  // UTF-16 offsets, as used by JS slice; no case/whitespace normalization.
  start: z.number().int().nonnegative(), end: z.number().int().positive(),
  quote: text.max(4_000),
  review: z.enum(["candidate_reported", "candidate_confirmed"]),
  independentlyVerified: z.literal(false),
}).strict();
export const AssessmentSchema = z.object({
  requirementId: id,
  status: RequirementAssessmentSchema.shape.status,
  evidenceIds: z.array(z.string().min(1).max(128)).max(50),
}).strict();
export const InventorySchema = z.array(RequirementSchema).min(1).max(30);
export const AssessmentsSchema = z.array(AssessmentSchema).min(1).max(30);
export const BaselineSchema = z.object({
  requirements: InventorySchema,
  sources: z.array(SourceSchema).min(1).max(170),
  evidence: z.array(EvidenceSchema).max(200),
  assessments: AssessmentsSchema,
}).strict();
export const AnswerSchema = SourceSchema.options[1];

export type Requirement = z.infer<typeof RequirementSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type CandidateEvidence = z.infer<typeof EvidenceSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type Baseline = z.infer<typeof BaselineSchema>;
export type SupportDecision = "supports" | "contradicts" | "unresolved";
/** Trusted application dependency, never a function/rule received from JSON.
 * Quote existence alone does not establish relevance. Inspect the FULL source
 * to avoid cherry-picking a positive phrase from a negative answer. */
export type EvidenceReviewer = (
  requirement: Readonly<Requirement>, source: Readonly<Source>,
  evidence: Readonly<CandidateEvidence>,
) => SupportDecision;

export type Coverage = {
  requiredRequirementIds: string[];
  supportedRequiredRequirementIds: string[];
  supported: number;
  total: number;
};
export type LedgerView = Omit<Baseline, "assessments"> & {
  before: Assessment[];
  after: Assessment[];
  coverage: { before: Coverage; after: Coverage };
};
export type ImpactProposal = {
  original: string;
  improved: string;
  supportingEvidence: CandidateEvidence[];
  reviewStatus: "ready_for_candidate_review" | "candidate_confirmed";
  independentlyVerified: false;
  followUpQuestions: string[];
};
