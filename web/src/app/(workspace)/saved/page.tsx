import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Saved Jobs | ScaleMe" };

export default function SavedPage() {
  return (
    <FeaturePlaceholder
      title="Saved Jobs"
      icon={Bookmark}
      summary="A saved-jobs list is not available yet. Saving a sample role on the dashboard keeps it on that page only."
      plannedSteps={[
        "Save roles from Discover or your dashboard.",
        "Open fit or interview for a saved role only after those pages can receive it.",
        "Track where each application stands.",
      ]}
      dependsOn="Saving across visits needs accounts and a reviewed storage and privacy design, which don't exist yet."
      action={{ href: routes.interview, label: "Practice an interview" }}
    />
  );
}
