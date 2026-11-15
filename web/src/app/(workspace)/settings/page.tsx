import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Profile & Settings | ScaleMe" };

export default function SettingsPage() {
  return (
    <FeaturePlaceholder
      title="Profile & Settings"
      icon={Settings}
      summary="Settings are not available yet. Guest setup collects optional goals for that visit."
      plannedSteps={[
        "Choose target roles, a work period or semester, and location or remote preferences.",
        "Optionally turn on work-authorization notes, which show what listings say about CPT, OPT, STEM OPT, sponsorship, or citizenship. ScaleMe never makes eligibility decisions.",
        "Manage or delete your data once accounts exist.",
      ]}
      dependsOn="Saved profiles need an authentication and privacy review. Nothing is stored yet."
      action={{ href: routes.onboarding, label: "Open guest setup" }}
    />
  );
}
