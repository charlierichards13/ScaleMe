import Link from "next/link";
import { buttonStyles } from "@/components/ui/primitives";
import type { Metadata } from "next";
import { MockInterviewWorkspace } from "./MockInterviewWorkspace";

export const metadata: Metadata = { title: "Mock Interviews | ScaleMe" };

export default function InterviewPage() {
  return <>
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-8">
      <p className="text-sm text-muted">Bring your own resume and job to the private AI interview and evidence report.</p>
      <Link href="/interview/contextual" className={buttonStyles.secondary}>Open contextual interview</Link>
    </div>
    <MockInterviewWorkspace />
  </>;
}
