import type { Metadata } from "next";
import { Suspense } from "react";
import ResumeFitWorkspace from "./resume-fit-workspace";

export const metadata: Metadata = {
  title: "Fit Evidence Explorer | ScaleMe",
  description: "Prepare extracted resume and job drafts and inspect clearly labeled fictional evidence. Live analysis is not available here yet.",
};
export default function FitInsightsPage() {
  return (
    <Suspense fallback={<p role="status">Loading Fit Evidence Explorer…</p>}>
      <ResumeFitWorkspace />
    </Suspense>
  );
}