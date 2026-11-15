"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check, FileText, ShieldCheck } from "lucide-react";
import { Badge, Card, buttonStyles, cx } from "@/components/ui/primitives";
import { ResumeUploadControls } from "@/components/resume/ResumeUploadControls";
import { useActiveResume } from "@/lib/resume/active-resume";
import { useResumeUpload } from "@/lib/resume/use-resume-upload";
import { routes } from "@/lib/routes";
import type { Resume } from "@/lib/ai/schemas";

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
  const upload = useResumeUpload();
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const uploadTitle = useRef<HTMLHeadingElement>(null);
  const hadResume = useRef(false);
  useEffect(() => {
    if (resume && !hadResume.current) reviewTitle.current?.focus();
    if (!resume && hadResume.current) uploadTitle.current?.focus();
    hadResume.current = !!resume;
  }, [resume]);

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
    <header className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><FileText aria-hidden="true" className="h-5 w-5" /></span>
      <div className="min-w-0"><h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Resume Lab</h1><p className="mt-1 text-sm leading-6 text-muted">Turn your experience into a clear starting point. Review first, then choose your next step.</p></div>
    </header>
    <div className="mt-4"><Badge tone="warning">Limited-time PDF extraction demo</Badge></div>
    <ol aria-label="Resume journey" className="my-6 grid grid-cols-3 gap-2 text-xs font-semibold sm:gap-4 sm:text-sm">
      {["Add resume", "Review extraction", "Continue"].map((step, index) => <li key={step} aria-current={index === (resume ? 1 : 0) ? "step" : undefined} className={cx("rounded-xl border px-3 py-3", index === (resume ? 1 : 0) ? "border-brand/30 bg-brand-soft text-brand-strong" : "border-line text-muted")}><span className="mr-1">{index + 1}.</span>{step}</li>)}
    </ol>
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
          {resume && <Link href={routes.fitInsights} className={cx(buttonStyles.primary, "mt-4 min-h-11 w-full")}>Open Fit Explorer<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
          <Link href={routes.impactLab} className={cx(buttonStyles.secondary, "mt-4 min-h-11 w-full")}>Explore evidence workflow</Link>
          <p className="mt-2 text-xs leading-5 text-muted">The existing Impact Lab accepts pasted resume and job text. Nothing is imported automatically; fictional samples are optional and labeled.</p>
          <Link href={routes.interview} className={cx(buttonStyles.ghost, "mt-3 min-h-11")}>Practice mock interviews<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          <p className="mt-1 text-xs leading-5 text-muted">Fixed questions, independent of this resume.</p>
        </Card>
        <Card aria-labelledby="resume-privacy-title"><h2 id="resume-privacy-title" className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand" />You control the next step</h2><p className="mt-2 text-sm leading-6 text-muted">No permanent PDF storage, account or saved profile. Parsed data stays in this tab until cleared or reloaded. Uploading does not send it to AI.</p></Card>
      </aside>
    </div>
  </div>;
}
