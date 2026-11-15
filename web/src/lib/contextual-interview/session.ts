import { z } from "zod";
import { FitRequestSchema, type FitAnalysis, type FitRequest } from "@/lib/ai/schemas";
import { INTERVIEW_FOCUSES, type InterviewResponse, type InterviewTurn } from "@/lib/ai/interview-schemas";

export type ContextDraft = { resume: string; title: string; job: string; requirements: string };
export const emptyDraft: ContextDraft = { resume: "", title: "", job: "", requirements: "" };

/** Each entered line is an explicit required requirement, never an invented extraction. */
export function prepareContext(draft: ContextDraft): FitRequest {
  const lines = draft.requirements.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 30 || lines.some(s => s.length > 1000)) {
    throw new Error("Enter 1–30 requirements, one per line, at most 1,000 characters each.");
  }
  const result = FitRequestSchema.safeParse({
    resume: { id: "session-resume", text: draft.resume },
    job: { id: "session-job", title: draft.title, text: draft.job,
      requirements: lines.map((description, i) => ({ id: `req-${i + 1}`, description, importance: "required" })) },
  });
  if (!result.success || draft.resume.length > 30_000 || draft.job.length > 20_000) throw new Error("Enter a resume (up to 30,000 characters), role title (200) and job description (20,000).");
  return { ...result.data,
    resume: { ...result.data.resume, text: draft.resume },
    job: { ...result.data.job, text: draft.job },
  };
}

export const TurnResponseSchema = z.object({ turn: z.object({
  coachMessage: z.string().trim().min(1).max(1000),
  focus: z.enum(INTERVIEW_FOCUSES), canFinish: z.boolean(),
  targetRequirementId: z.string().min(1).max(50).optional(),
}) });

export function fitContext(analysis: FitAnalysis) {
  return { assessments: analysis.assessments.map(({ requirementId, status }) => ({ requirementId, status })) };
}

export function coachHistory(turn: InterviewResponse): InterviewTurn {
  return { role: "coach", content: turn.coachMessage,
    ...(turn.targetRequirementId ? { targetRequirementId: turn.targetRequirementId } : {}) };
}

export function answerHistory(history: InterviewTurn[], raw: string): InterviewTurn[] {
  const content = raw.trim();
  if (!content || content.length > 2000) throw new Error("Enter an answer of 1–2,000 characters.");
  if (history.at(-1)?.role !== "coach" || history.length > 11) throw new Error("This interview cannot accept another answer.");
  return [...history, { role: "candidate", content }];
}

/** Local integration boundary only: no new wire contract, persistence or inferred coverage. */
export function collectEvidence(context: FitRequest, analysis: FitAnalysis, history: InterviewTurn[]) {
  const known = new Set(context.job.requirements?.map(r => r.id));
  const answers = history.flatMap((turn, index) => {
    if (turn.role !== "candidate") return [];
    const question = history[index - 1];
    const target = question?.targetRequirementId;
    return [{ id: `interview-answer-${index}`, source: "interview" as const,
      sourceRef: `turn-${index}`, quote: turn.content, review: "candidate_reported" as const,
      question: question.content,
      ...(target && known.has(target) ? { targetRequirementId: target } : {}),
    }];
  });
  return { version: "local-interview-handoff-v1" as const, context, initialAnalysis: analysis,
    history, answers, reassessment: "pending" as const };
}
export type EvidenceHandoff = ReturnType<typeof collectEvidence>;
