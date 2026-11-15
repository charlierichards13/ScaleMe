import { LIMITS, type FitRequest } from "@/lib/ai/schemas";

export const draftLimits = {
  resume: LIMITS.resumeText,
  title: 200,
  job: LIMITS.jobText,
} as const;
export type FitDraft = { resume: string; title: string; job: string };
export type DraftErrors = Partial<Record<keyof FitDraft, string>>;
export const emptyDraft: FitDraft = { resume: "", title: "", job: "" };

export function validateDraft(draft: FitDraft): DraftErrors {
  const errors: DraftErrors = {};
  for (const key of ["resume", "title", "job"] as const) {
    if (!draft[key].trim())
      errors[key] = "Add text before preparing this draft.";
    else if (draft[key].length > draftLimits[key])
      errors[key] =
        `Use ${draftLimits[key].toLocaleString("en-US")} characters or fewer.`;
  }
  // JSON escaping and UTF-8 can exceed the byte cap even within character caps.
  if (
    !Object.keys(errors).length &&
    new TextEncoder().encode(JSON.stringify(toFitRequest(draft))).byteLength >
      LIMITS.requestBodyBytes
  ) {
    errors.job =
      "The combined draft is too large. Shorten the resume or job text.";
  }
  return errors;
}

/** Local preparation only. This function never sends, stores or analyzes text. */
export function toFitRequest(draft: FitDraft): FitRequest {
  return {
    resume: { id: "resume-draft", text: draft.resume.trim() },
    job: { id: "job-draft", title: draft.title.trim(), text: draft.job.trim() },
  };
}
