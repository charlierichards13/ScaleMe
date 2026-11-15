import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";

export const metadata: Metadata = { title: "Resume Lab | ScaleMe" };

export default function ResumeLabPage() {
  return (
    <FeaturePlaceholder
      title="Resume Lab"
      icon={FileText}
      summary="Upload your resume, then let ScaleMe grill you on each project until the real impact is clear. Bullets are rewritten only from facts you confirm."
      plannedSteps={[
        "Upload a text-based PDF or paste your resume.",
        "Pick a project and answer follow-ups: problem, your contribution, technical decisions, trade-offs, evidence, impact.",
        "Review suggested bullets grounded in your answers. Unknown metrics stay as questions, never guesses.",
      ]}
      dependsOn="Uploading needs secure PDF parsing (Issue #4). To see how grilling works today, open the fictional Resume Impact Lab at /impact-lab, or paste resume text into the Career Coach demo."
    />
  );
}
