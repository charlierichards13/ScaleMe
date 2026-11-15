import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { FeaturePlaceholder } from "@/components/layout/FeaturePlaceholder";

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
      summary="Browse internships and jobs that match your goals, skills and schedule, then save the ones worth a closer look."
      plannedSteps={[
        "Swipe through role cards and save or pass on each one.",
        "Review your shortlist and remove anything that no longer fits.",
        "Send a saved role to Fit Analysis or a mock interview.",
      ]}
      dependsOn="A fictional swipe-based preview is in review (PR #37) and will replace this page once merged. Real listings will come later from a server-side jobs service, never from scraping in your browser."
    />
  );
}
