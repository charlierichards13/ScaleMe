import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";

export const metadata: Metadata = { title: "Fit Analysis | ScaleMe" };

export default function FitPage() {
  return (
    <FeaturePlaceholder
      title="Fit Analysis"
      icon={Scale}
      summary="Compare your experience with a job description, requirement by requirement, with the resume evidence behind every finding."
      plannedSteps={[
        "Add a job by pasting its description.",
        "See each requirement marked Supported, Not evidenced, or Needs clarification, with quoted evidence.",
        "Get clarification questions for anything your resume doesn't show yet.",
      ]}
      dependsOn="Waiting on the server-side /api/fit/analyze integration (Issues #6, #32). Results will be coaching guidance, never a hiring probability. The Career Coach demo has a simple keyword comparison in the meantime."
    />
  );
}
