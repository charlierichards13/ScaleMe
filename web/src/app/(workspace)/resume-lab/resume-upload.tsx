"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileText, ShieldCheck } from "lucide-react";
import { Badge, Card, buttonStyles, cx } from "@/components/ui/primitives";
import { ResumeUploadControls } from "@/components/resume/ResumeUploadControls";
import { useActiveResume } from "@/lib/resume/active-resume";
import { useResumeUpload } from "@/lib/resume/use-resume-upload";
import { routes } from "@/lib/routes";
import type { Resume } from "@/lib/ai/schemas";
import ImpactLab from "@/app/impact-lab/impact-lab";

export function ResumeReview({ resume }: { resume: Resume }) {
  return <div className="mt-6 space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-canvas p-4"><p className="text-2xl font-bold text-ink">{resume.sections?.length ?? 0}</p><p className="text-sm text-muted">Detected sections</p></div>
      <div className="rounded-xl bg-canvas p-4"><p className="text-2xl font-bold text-ink">{resume.text.length.toLocaleString()}</p><p className="text-sm text-muted">Extracted characters</p></div>
    </div>
    <p className="text-sm leading-6 text-muted">PDF reading order and section detection are best-effort. Check dates, bullets and columns against your PDF. Missing details are never filled in for you.</p>
    {!!resume.sections?.length ? <div className="space-y-3" aria-label="Detected resume sections">
      {resume.sections.map((section, index) => <details key={index} className="rounded-xl border border-line p-4">
        <summary className={cx("cursor-pointer break-words font-semibold text-ink [overflow-wrap:anywhere]", buttonStyles.focusRing)}>{section.heading}</summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{section.text}</p>
      </details>)}
    </div> : <p className="rounded-xl border border-line p-4 text-sm leading-6">No sections were confidently detected. Your extracted text is still available below.</p>}
    <details open className="rounded-xl border border-line p-4"><summary className={cx("cursor-pointer font-semibold", buttonStyles.focusRing)}>Full resume text</summary>
      <p className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{resume.text}</p>
    </details>
    <details className="rounded-xl border border-line p-4 text-muted"><summary className={cx("cursor-pointer text-sm font-medium", buttonStyles.focusRing)}>Technical details · Resume JSON</summary>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">{JSON.stringify({ resume }, null, 2)}</pre>
    </details>
  </div>;
}

export default function ResumeUpload() {
  const resume = useActiveResume();
  // Replacing/clearing the validated input destroys every old improvement draft.
  return <ResumeWorkspace key={resume?.id ?? "no-resume"} resume={resume} />;
}

export function ResumeWorkspace({ resume }: { resume: Resume | null }) {
  const upload = useResumeUpload();
  const [improving, setImproving] = useState(false);
  const [startedImprovement, setStartedImprovement] = useState(false);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const uploadTitle = useRef<HTMLHeadingElement>(null);
  const improveTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (improving) improveTitle.current?.focus();
    else if (resume) reviewTitle.current?.focus();
    else uploadTitle.current?.focus();
  }, [resume, improving]);

  function improve() { setStartedImprovement(true); setImproving(true); }

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
    <header className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><FileText aria-hidden="true" className="h-5 w-5" /></span>
      <div className="min-w-0"><h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Resume Lab</h1><p className="mt-1 text-sm leading-6 text-muted">Turn your experience into a clear starting point. Review first, then choose your next step.</p></div>
    </header>
    <div className="mt-4"><Badge tone="warning">Private preview · synthetic input only</Badge></div>
    <ol aria-label="Resume journey" className="my-6 grid grid-cols-3 gap-2 text-xs font-semibold sm:gap-4 sm:text-sm">
      {["Add resume", "Review extraction", "Improve experience"].map((step, index) => <li key={step} aria-current={index === (improving ? 2 : resume ? 1 : 0) ? "step" : undefined} className={cx("rounded-xl border px-3 py-3", index === (improving ? 2 : resume ? 1 : 0) ? "border-brand/30 bg-brand-soft text-brand-strong" : "border-line text-muted")}><span className="mr-1">{index + 1}.</span>{step}</li>)}
    </ol>
    <div hidden={improving}>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="min-w-0" aria-labelledby={resume ? "resume-review-title" : "resume-add-title"}>
        {resume ? <>
          <div className="flex items-start gap-3"><Check aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-emerald-700" /><div className="min-w-0"><h2 id="resume-review-title" ref={reviewTitle} tabIndex={-1} className={cx("rounded text-lg font-semibold", buttonStyles.focusRing)}>Your resume is ready to review</h2><p className="mt-1 break-all text-sm text-muted">{resume.filename ?? "Extracted resume"}</p></div></div>
          <ResumeReview resume={resume} />
          <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
            <button type="button" onClick={upload.clear} className={cx(buttonStyles.secondary, "min-h-11")}>Replace resume</button>
            <button type="button" onClick={upload.clear} className={cx(buttonStyles.ghost, "min-h-11")}>Clear resume</button>
          </div>
        </> : <>
          <h2 id="resume-add-title" ref={uploadTitle} tabIndex={-1} className={cx("mb-5 rounded text-lg font-semibold", buttonStyles.focusRing)}>Add a PDF resume</h2>
          <ResumeUploadControls upload={upload} />
        </>}
      </Card>
      <aside className="space-y-5">
        <Card aria-labelledby="resume-next-title"><h2 id="resume-next-title" className="font-semibold">Choose what comes next</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{resume ? "Your reviewed text can fill the existing Fit Explorer draft. Live analysis remains unavailable there." : "Extract a resume to bring its text into Fit Explorer. No analysis starts automatically."}</p>
          {resume && <><button type="button" onClick={improve} className={cx(buttonStyles.primary, "mt-4 min-h-11 w-full")}>Improve my resume<ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
            <Link href={routes.fitInsights} className={cx(buttonStyles.secondary, "mt-3 min-h-11 w-full")}>Open Fit Explorer<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></>}
          {!resume && <button type="button" onClick={improve} className={cx(buttonStyles.secondary, "mt-4 min-h-11 w-full")}>Use pasted resume text</button>}
          <p className="mt-2 text-xs leading-5 text-muted">Improve locally with a target job, exact source statements and candidate confirmation. Nothing is sent to AI.</p>
          <Link href={routes.interview} className={cx(buttonStyles.ghost, "mt-3 min-h-11")}>Practice mock interviews<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          <p className="mt-1 text-xs leading-5 text-muted">Fixed questions, independent of this resume.</p>
        </Card>
        <Card aria-labelledby="resume-privacy-title"><h2 id="resume-privacy-title" className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand" />You control the next step</h2><p className="mt-2 text-sm leading-6 text-muted">No permanent PDF storage, account or saved profile. Parsed data stays in this tab until cleared or reloaded. Uploading does not send it to AI.</p></Card>
      </aside>
    </div>
    </div>
    {startedImprovement && <section hidden={!improving} aria-labelledby="resume-improve-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="resume-improve-title" ref={improveTitle} tabIndex={-1} className={cx("rounded text-lg font-semibold", buttonStyles.focusRing)}>Improve your resume</h2>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setImproving(false)} className={cx(buttonStyles.secondary, "min-h-11")}>{resume ? "Review extraction" : "Back to upload"}</button>
          {resume && <Link href={routes.fitInsights} className={cx(buttonStyles.secondary, "min-h-11")}>Open Fit Explorer</Link>}</div>
      </div>
      <p className="mb-5 text-sm leading-6 text-muted">{resume ? `Using ${resume.filename ?? "your extracted resume"}. ` : "Paste your own synthetic resume below. "}Job text, answers and reviews stay in this workspace when you switch stages. Reset improvement explicitly to start over; replacing or clearing the resume discards its improvement.</p>
      <ImpactLab initialResume={resume ?? undefined} embedded integrated />
    </section>}
  </div>;
}
