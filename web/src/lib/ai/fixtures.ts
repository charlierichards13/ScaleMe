// SYNTHETIC test data only. No real applicant or employer information.

import type { FitRequest } from "./schemas";

export const syntheticRequest: FitRequest = {
  resume: {
    id: "resume-demo",
    text: "Alex Example\nSoftware engineer. Built an internal employee portal using React and Node.\nWrote REST APIs for the portal.",
  },
  job: {
    id: "job-demo",
    title: "Software Engineer Intern",
    text: "Requirements: experience with APIs. Experience with automated testing.",
    requirements: [
      { id: "r1", description: "Experience with APIs", importance: "required" },
      { id: "r2", description: "Automated testing", importance: "required" },
    ],
  },
};

export const goodModelOutput = {
  summary: "The resume shows API work but no testing.",
  assessments: [
    {
      requirementId: "r1",
      status: "supported",
      explanation: "Candidate wrote REST APIs.",
      evidence: [{ source: "resume", quote: "Wrote REST APIs for the portal." }],
    },
    {
      requirementId: "r2",
      status: "not_evidenced",
      explanation: "No testing is described.",
      evidence: [],
    },
  ],
  strengths: ["Built an internal portal"],
  clarificationQuestions: ["How did you test the portal?"],
  growthSuggestions: ["If true, add a testing example."],
  disclaimer: "model-written disclaimer that should be replaced",
};
