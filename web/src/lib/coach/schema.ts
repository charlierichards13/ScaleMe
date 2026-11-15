import { z } from "zod";

export const COACH_LIMITS = {
  bodyBytes: 96 * 1024, messages: 11, turnChars: 2000,
  resumeChars: 12000, jobChars: 8000, contextChars: 24000,
  replyChars: 2000, outputTokens: 500, bodyTimeoutMs: 10000,
} as const;
const text = (max: number) => z.string().trim().min(1).max(max);
export const CoachMessageSchema = z.object({
  role: z.enum(["user", "assistant"]), content: text(COACH_LIMITS.turnChars),
}).strict();
export type CoachMessage = z.infer<typeof CoachMessageSchema>;
export const CoachRequestSchema = z.object({
  consent: z.literal(true),
  messages: z.array(CoachMessageSchema).min(1).max(COACH_LIMITS.messages),
  context: z.object({ resume: text(COACH_LIMITS.resumeChars).optional(), job: text(COACH_LIMITS.jobChars).optional() }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.messages.length % 2 !== 1 || value.messages.some((m, i) => m.role !== (i % 2 ? "assistant" : "user"))) {
    ctx.addIssue({ code: "custom", message: "History must alternate and end with a user message." });
  }
  const total = value.messages.reduce((n, m) => n + m.content.length, 0) +
    (value.context?.resume?.length ?? 0) + (value.context?.job?.length ?? 0);
  if (total > COACH_LIMITS.contextChars) ctx.addIssue({ code: "custom", message: "Combined context is too long." });
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;
export const CoachModelSchema = z.object({ reply: text(COACH_LIMITS.replyChars) }).strict();
export const CoachResponseSchema = z.object({
  message: z.object({ role: z.literal("assistant"), content: text(COACH_LIMITS.replyChars) }).strict(),
  advisory: z.literal("unverified"),
}).strict();
