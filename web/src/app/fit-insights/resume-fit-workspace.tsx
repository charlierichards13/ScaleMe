"use client";

import Link from "next/link";
import { setActiveResume, useActiveResume } from "@/lib/resume/active-resume";
import FitExplorer from "./fit-explorer";

/** Preserve the team's explorer and its intentional live-AI gate; seed its existing draft. */
export default function ResumeFitWorkspace() {
  const resume = useActiveResume();
  return <>
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 p-4">
      <Link className="underline" href="/resume-lab">Upload or review a PDF in Resume Lab</Link>
      {resume && <><span>Using extracted {resume.filename ?? "resume"} · held in tab memory</span>
        <button className="underline" onClick={() => setActiveResume(null)}>Forget uploaded resume</button></>}
    </div>
    <FitExplorer key={resume?.id ?? "manual"} uploadedResume={resume} />
  </>;
}