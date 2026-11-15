import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Resume Lab | ScaleMe" };

export default function ResumeLabPage() {
  return (
    <FeaturePlaceholder
      title="Resume Lab"
      icon={FileText}
      summary="Resume upload is not available yet. The sample resume story lets you confirm quotes and copy a supported bullet."
      plannedSteps={[
        "Upload a text-based PDF or paste your resume.",
        "Pick a project and answer follow-ups: problem, your contribution, technical decisions, trade-offs, evidence, impact.",
        "Review suggested bullets grounded in your answers. Unknown metrics stay as questions, never guesses.",
      ]}
      dependsOn="Uploading needs secure PDF parsing (Issue #4). The sample story is separate from this page."
      action={{ href: routes.impactLab, label: "Open the sample resume story" }}
    />
  );
}
