import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";

export const metadata: Metadata = { title: "Saved Jobs | ScaleMe" };

export default function SavedPage() {
  return (
    <FeaturePlaceholder
      title="Saved Jobs"
      icon={Bookmark}
      summary="Keep a shortlist of roles to analyze, practice for, and eventually track through your applications."
      plannedSteps={[
        "Save roles from Discover or your dashboard.",
        "Run a fit analysis or mock interview for any saved role.",
        "Track where each application stands.",
      ]}
      dependsOn="Saving across visits needs accounts and a reviewed storage and privacy design, which don't exist yet. Saves on the dashboard last only for the current tab."
    />
  );
}
