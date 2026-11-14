// Runtime (Zod) versions of the contracts in docs/api-contract.md.
// These mirror the documented types: Evidence, Resume, JobPosting, FitAnalysis.
// If the contract changes, change it in the docs first and then here.

import { z } from "zod";

// Size limits keep cost and abuse bounded. Resumes/jobs longer than this are rejected.
export const LIMITS = {
  resumeText: 30_000,
  jobText: 20_000,
  requirements: 30,
  requestBodyBytes: 200_000,
} as const;

export const EvidenceSchema = z.object({
  source: z.enum(["resume", "job", "interview"]),
  quote: z.string().min(1).max(500),
  section: z.string().max(100).optional(),
});

export const ResumeSchema = z.object({
  id: z.string().min(1).max(100),
  filename: z.string().max(255).optional(),
  text: z.string().trim().min(1).max(LIMITS.resumeText),
  sections: z
    .array(z.object({ heading: z.string().max(200), text: z.string().max(LIMITS.resumeText) }))
    .max(50)
    .optional(),
});

export const JobPostingSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  company: z.string().max(200).optional(),
  sourceUrl: z.string().max(2000).optional(),
  text: z.string().trim().min(1).max(LIMITS.jobText),
  requirements: z
    .array(
      z.object({
        id: z.string().min(1).max(50),
        description: z.string().min(1).max(1000),
        importance: z.enum(["required", "preferred", "unspecified"]),
      }),
    )
    .max(LIMITS.requirements)
    .optional(),
});

export const FitRequestSchema = z.object({
  resume: ResumeSchema,
  job: JobPostingSchema,
});

export const RequirementAssessmentSchema = z.object({
  requirementId: z.string().min(1).max(50),
  status: z.enum(["supported", "not_evidenced", "unclear"]),
  explanation: z.string().min(1).max(1000),
  evidence: z.array(EvidenceSchema).max(5),
});

export const FitAnalysisSchema = z.object({
  summary: z.string().min(1).max(1500),
  assessments: z.array(RequirementAssessmentSchema).min(1).max(LIMITS.requirements),
  strengths: z.array(z.string().min(1).max(500)).max(10),
  clarificationQuestions: z.array(z.string().min(1).max(500)).max(10),
  growthSuggestions: z.array(z.string().min(1).max(500)).max(10),
  disclaimer: z.string().max(500),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type JobPosting = z.infer<typeof JobPostingSchema>;
export type FitRequest = z.infer<typeof FitRequestSchema>;
export type RequirementAssessment = z.infer<typeof RequirementAssessmentSchema>;
export type FitAnalysis = z.infer<typeof FitAnalysisSchema>;

export type ApiError = {
  error: { code: string; message: string; retryable: boolean };
};

// A small error class so the route can turn any failure into a safe ApiError.
export class FitApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean,
    public status: number,
  ) {
    super(message);
    this.name = "FitApiError";
  }
}

export const DISCLAIMER =
  "This assessment is coaching guidance based only on the text provided, not a prediction of hiring outcomes. " +
  "\"Not evidenced\" means not shown in the resume, not that you lack the skill.";
