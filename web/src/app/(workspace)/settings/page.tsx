import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";

export const metadata: Metadata = { title: "Profile & Settings | ScaleMe" };

export default function SettingsPage() {
  return (
    <FeaturePlaceholder
      title="Profile & Settings"
      icon={Settings}
      summary="Set your goals once so every recommendation, analysis, and interview fits what you're aiming for."
      plannedSteps={[
        "Choose target roles, a work period or semester, and location or remote preferences.",
        "Optionally turn on work-authorization notes, which show what listings say about CPT, OPT, STEM OPT, sponsorship, or citizenship. ScaleMe never makes eligibility decisions.",
        "Manage or delete your data once accounts exist.",
      ]}
      dependsOn="Sign-in, onboarding, and saved profiles are separate work that needs an authentication and privacy review. Nothing is stored yet."
    />
  );
}
