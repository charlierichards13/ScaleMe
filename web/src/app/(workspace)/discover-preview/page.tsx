import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Discover Opportunities | ScaleMe" };

/**
 * TEMPORARY placeholder until PR #37 adds the real `/discover` route.
 * Delete this folder and point `routes.discover` at "/discover" then.
 */
export default function DiscoverPreviewPage() {
  return (
    <FeaturePlaceholder
      title="Discover Opportunities"
      icon={Compass}
      summary="Role browsing is not in this build yet. You can open the fit explorer in the meantime."
      plannedSteps={[
        "Swipe through role cards and save or pass on each one.",
        "Review your shortlist and remove anything that no longer fits.",
        "Open fit or interview for a saved role only after those pages can receive it.",
      ]}
      dependsOn="A fictional swipe deck is in review and is not part of this build. Live listings are not connected."
      action={{ href: routes.fitInsights, label: "Open the fit explorer" }}
    />
  );
}
