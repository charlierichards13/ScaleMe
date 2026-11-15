import type { Metadata } from "next";
import ImpactLab from "./impact-lab";

export const metadata: Metadata = {
  title: "Resume Impact Lab | ScaleMe",
  description: "Explore a fictional, evidence-grounded resume coaching demo. No live AI or uploads.",
};

export default function ImpactLabPage() {
  return <ImpactLab />;
}
