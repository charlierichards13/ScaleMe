import type { Metadata } from "next";
import { MockInterviewWorkspace } from "./MockInterviewWorkspace";

export const metadata: Metadata = { title: "Mock Interviews | ScaleMe" };

export default function InterviewPage() {
  return <MockInterviewWorkspace />;
}
