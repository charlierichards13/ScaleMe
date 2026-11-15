import type { Metadata } from "next";
import ImpactLab from "./impact-lab";

export const metadata: Metadata = {
  title: "Resume Impact Lab | ScaleMe",
  description: "Assess your resume, discover requirement evidence, and review grounded wording locally. No model calls or saved data.",
};

export default function ImpactLabPage() {
  return <ImpactLab />;
}
