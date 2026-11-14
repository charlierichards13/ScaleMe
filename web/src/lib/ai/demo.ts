// DEMO ONLY: a hand-written synthetic example. It is NOT produced by AWS and does not
// analyze any real input. The API returns it only when the caller explicitly asks for
// `?demo=true`, and the text is labeled so the UI cannot mistake it for live output.

import { DISCLAIMER, type FitAnalysis } from "./schemas";

export const DEMO_LABEL = "DEMO (synthetic sample, not a live AWS Bedrock result)";

export const demoAnalysis: FitAnalysis = {
  summary:
    "DEMO: This synthetic resume shows internal application work but does not describe a testing approach.",
  assessments: [
    {
      requirementId: "r1",
      status: "supported",
      explanation: "The synthetic candidate describes building an internal portal.",
      evidence: [{ source: "resume", quote: "Built an internal employee portal." }],
    },
    {
      requirementId: "r2",
      status: "not_evidenced",
      explanation: "The synthetic resume does not explain how features were tested.",
      evidence: [],
    },
  ],
  strengths: ["Experience building an internal application"],
  clarificationQuestions: ["How did you test the portal before release?"],
  growthSuggestions: ["If you have an accurate testing example, consider adding it."],
  disclaimer: `${DEMO_LABEL}. ${DISCLAIMER}`,
};
