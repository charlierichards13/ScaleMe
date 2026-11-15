import type { Metadata } from "next";
import { Mic } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";

export const metadata: Metadata = { title: "Mock Interviews | ScaleMe" };

export default function InterviewPage() {
  return (
    <FeaturePlaceholder
      title="Mock Interviews"
      icon={Mic}
      summary="Practice with a role-aware interviewer that asks one focused follow-up at a time, based on your own resume and the target job."
      plannedSteps={[
        "Choose a target role and interview style (technical or behavioral).",
        "Answer questions that build on what you said before.",
        "Review talking points drawn from your answers.",
      ]}
      dependsOn="The live interviewer depends on the /api/interview/next endpoint (Issue #7). A scripted five-question practice interview is available in the Career Coach demo."
    />
  );
}
