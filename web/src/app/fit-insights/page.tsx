import type { Metadata } from "next";
import FitExplorer from "./fit-explorer";
import ResumeFitWorkspace from "./resume-fit-workspace";

export const metadata: Metadata = {
  title: "Fit Evidence Explorer | ScaleMe",
  description:
    "Inspect a fictional candidate’s documented evidence. An offline demo, not a hiring prediction.",
};
export default function FitInsightsPage() {
  return <ResumeFitWorkspace><FitExplorer /></ResumeFitWorkspace>;
}
