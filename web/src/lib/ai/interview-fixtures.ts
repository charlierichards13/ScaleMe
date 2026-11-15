// SYNTHETIC test data only. No real applicant or employer information.

import type { InterviewRequest, InterviewTurn } from "./interview-schemas";

export const interviewJob: InterviewRequest["job"] = {
  id: "job-demo",
  title: "Software Engineer Intern",
  text: "Requirements: experience with APIs. Experience testing web applications. Preferred: documentation.",
  requirements: [
    { id: "r1", description: "Experience with APIs", importance: "required" },
    { id: "r2", description: "Experience testing web applications", importance: "required" },
    { id: "r3", description: "Writing technical documentation", importance: "preferred" },
  ],
};

export const interviewRequest: InterviewRequest = {
  resume: {
    id: "resume-demo",
    text: "Alex Example\nSoftware engineer. Built an internal employee portal using React and Node.\nWrote REST APIs for the portal.",
  },
  job: interviewJob,
  history: [],
  fit: {
    assessments: [
      { requirementId: "r1", status: "supported" },
      { requirementId: "r2", status: "not_evidenced" },
      { requirementId: "r3", status: "unclear" },
    ],
  },
};

/** Build a history of `n` coach/candidate pairs. Coach turns echo `targets[i]` when given. */
export function historyOf(n: number, targets: Array<string | undefined> = []): InterviewTurn[] {
  return Array.from({ length: n }, (_, i) => [
    { role: "coach" as const, content: `Coach question ${i + 1}?`, ...(targets[i] ? { targetRequirementId: targets[i] } : {}) },
    { role: "candidate" as const, content: `Synthetic answer ${i + 1} about the portal.` },
  ]).flat();
}

export const modelReply = (coachMessage: string) => JSON.stringify({ coachMessage });
