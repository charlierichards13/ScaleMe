// Runtime (Zod) schemas for POST /api/interview/next (docs/api-contract.md).
// v0.1 request { resume, job, history } stays valid. Additive, optional fields:
//   - InterviewTurn.targetRequirementId (coach turns only; echoed back by the client)
//   - fit: { assessments: [{ requirementId, status }] } (the client's earlier fit result)
// Everything here is UNTRUSTED client data. Fit statuses only influence which requirement
// the server asks about next; they are never treated as verified evidence.

import { z } from "zod";
import { JobPostingSchema, ResumeSchema } from "./schemas";

export const INTERVIEW_LIMITS = {
  /** Total turns in `history` (coach + candidate). 12 = up to 6 coach turns. */
  historyTurns: 12,
  /** Per-turn text limit, after trimming. Matches the /interview UI answer limit. */
  turnText: 2000,
  /** Coach message limit for model output. */
  coachMessage: 1000,
  /** Output-token cap for one interview turn (lower than fit analysis). */
  maxOutputTokens: 400,
} as const;

export const INTERVIEW_FOCUSES = ["context", "contribution", "tradeoffs", "impact", "reflection"] as const;
export type InterviewFocus = (typeof INTERVIEW_FOCUSES)[number];

export const InterviewTurnSchema = z.object({
  role: z.enum(["coach", "candidate"]),
  content: z.string().trim().min(1).max(INTERVIEW_LIMITS.turnText),
  targetRequirementId: z.string().min(1).max(50).optional(),
});

// Only requirementId and status are read. Other FitAnalysis assessment fields
// (explanation, evidence) are accepted for convenience but stripped and never used:
// a client-supplied explanation or quote must not reach the model as "evidence".
export const FitContextSchema = z.object({
  assessments: z
    .array(
      z.object({
        requirementId: z.string().min(1).max(50),
        status: z.enum(["supported", "not_evidenced", "unclear"]),
      }),
    )
    .max(30),
});

export const InterviewRequestSchema = z.object({
  resume: ResumeSchema,
  job: JobPostingSchema,
  history: z.array(InterviewTurnSchema).max(INTERVIEW_LIMITS.historyTurns),
  fit: FitContextSchema.optional(),
});

/** What the model must return. Any other key (focus, targetRequirementId, ...) is stripped. */
export const InterviewModelOutputSchema = z.object({
  coachMessage: z.string().trim().min(1).max(INTERVIEW_LIMITS.coachMessage),
});

export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;
export type FitContext = z.infer<typeof FitContextSchema>;
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;

/** v0.1 InterviewResponse plus the additive v0.2 `targetRequirementId`. */
export type InterviewResponse = {
  coachMessage: string;
  focus: InterviewFocus;
  canFinish: boolean;
  targetRequirementId?: string;
};
