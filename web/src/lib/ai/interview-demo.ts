// DEMO ONLY: a hand-written, fixed interview script. It is NOT produced by AWS and does not
// read any request body. POST /api/interview/next?demo=true&step=N returns DEMO_INTERVIEW_STEPS[N].
// It follows the synthetic story in docs/DIFFERENTIATION.md and uses the same requirement ids as
// the fit demo (lib/ai/demo.ts): r1 (supported) and r2 "testing" (not_evidenced).
//
// Coach messages refer to the SAMPLE candidate answers below, not to anything a user typed.
// A UI showing this demo must show those sample answers (or say it is a fixed script) so the
// coach never appears to react to the user's own words.

import { DEMO_LABEL } from "./demo";
import type { InterviewResponse } from "./interview-schemas";

export { DEMO_LABEL };

export type DemoInterviewStep = {
  turn: InterviewResponse;
  /** Synthetic answer the next step's coach message refers to; absent on the closing step. */
  sampleCandidateAnswer?: string;
};

export const DEMO_INTERVIEW_STEPS: readonly DemoInterviewStep[] = [
  {
    turn: {
      coachMessage:
        "DEMO: The sample posting asks for experience testing web applications, and the sample resume does not mention testing. That does not mean you have not done it. How did you check the employee portal before colleagues started using it?",
      focus: "contribution",
      canFinish: false,
      targetRequirementId: "r2",
    },
    sampleCandidateAnswer: "I checked that it worked before we launched it.",
  },
  {
    turn: {
      coachMessage:
        "DEMO: You said you checked that it worked before launch, but not which parts or how. Which parts of the portal did you test, and who tried it with you? It is fine to say if nothing was measured.",
      focus: "impact",
      canFinish: false,
      targetRequirementId: "r2",
    },
    sampleCandidateAnswer:
      "I tested login, navigation, and the mobile layout with coworkers before rollout. We fixed a broken menu on phones. I didn't measure anything after launch.",
  },
  {
    turn: {
      coachMessage:
        "DEMO: You tested login, navigation and the mobile layout with coworkers and fixed a broken phone menu; nothing was measured after launch, so that result stays unknown rather than becoming a number. What would you explain more clearly next time about how you chose what to test?",
      focus: "reflection",
      canFinish: true,
    },
    sampleCandidateAnswer: "I'd explain that I picked the screens coworkers used most.",
  },
  {
    turn: {
      coachMessage:
        "DEMO: You chose the screens coworkers used most. This practice session is complete. Use only details that are true for you when you update your resume.",
      focus: "reflection",
      canFinish: true,
    },
  },
];

/** Returns the step, or undefined when `raw` is not an integer step in range. */
export function demoInterviewStep(raw: string | null): DemoInterviewStep | undefined {
  const value = raw ?? "0";
  if (!/^\d{1,2}$/.test(value)) return undefined;
  return DEMO_INTERVIEW_STEPS[Number(value)];
}
