import type { Metadata } from "next";
import { Suspense } from "react";
import FitExplorer from "./fit-explorer";

export const metadata: Metadata = {
  title: "Fit Evidence Explorer | ScaleMe",
  description:
    "Prepare resume and job drafts and inspect clearly labeled fictional evidence. Live analysis is not available yet.",
};
export default function FitInsightsPage() {
  return (
    <Suspense fallback={<p role="status">Loading Fit Evidence Explorer…</p>}>
      <FitExplorer />
    </Suspense>
  );
}
