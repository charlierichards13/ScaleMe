"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useActiveResume } from "@/lib/resume/active-resume";
import { analyzeUploadedResume } from "@/lib/resume/client";
import type { FitAnalysis } from "@/lib/ai/schemas";

export default function ResumeFitWorkspace({ children }: { children: ReactNode }) {
  const resume = useActiveResume();
  const [demo, setDemo] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ resumeId: string; analysis: FitAnalysis } | null>(null);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), [resume]);
  const analysis = result?.resumeId === resume?.id ? result?.analysis : null;

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (!resume || !consent || busy) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(""); setResult(null);
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const analysis = await analyzeUploadedResume(resume, title, text, controller.signal);
      if (!controller.signal.aborted) setResult({ resumeId: resume.id, analysis });
    } catch { if (!controller.signal.aborted) setError("Analysis is unavailable or was rejected. No fictional result was substituted."); }
    finally { clearTimeout(timer); setBusy(false); operation.current = null; }
  }

  if (!resume || demo) return <>
    <div className="mx-auto flex max-w-5xl flex-wrap gap-4 p-4">
      <Link className="underline" href="/resume-lab">Upload a PDF in Resume Lab</Link>
      {resume && <button className="underline" onClick={() => setDemo(false)}>Return to uploaded resume</button>}
    </div>
    {children}
  </>;
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-3xl font-bold">Fit Explorer — uploaded resume</h1>
    <p>Using {resume.filename ?? "your extracted resume"}. This tab holds {resume.text.length.toLocaleString()} characters of extracted text.</p>
    <div className="flex gap-4"><Link className="underline" href="/resume-lab">Review or clear resume</Link><button className="underline" onClick={() => setDemo(true)}>Open the separate fictional demo</button></div>
    <form onSubmit={analyze} className="grid gap-4 rounded-xl border border-line bg-surface p-5">
      <label className="grid gap-1">Target job title<input className="rounded border border-line p-2" value={title} onChange={(e) => { setTitle(e.target.value); setResult(null); }} maxLength={200} required disabled={busy} /></label>
      <label className="grid gap-1">Job description<textarea className="min-h-44 rounded border border-line p-2" value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} maxLength={20_000} required disabled={busy} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />I agree to send this resume and job text to Amazon Bedrock for analysis. Use synthetic data in this private preview.</label>
      <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={!consent || busy}>{busy ? "Analyzing…" : "Analyze with the existing fit API"}</button>
      <p className="text-sm text-muted">Live analysis also requires the server’s existing AI access and cost controls. Nothing is sent automatically. AI interview integration is a separate follow-up.</p>
    </form>
    {error && <p role="alert">{error}</p>}
    {analysis && <section className="space-y-4" aria-live="polite">
      <h2 className="text-xl font-bold">Analysis of the uploaded resume</h2><p>{analysis.summary}</p>
      {analysis.assessments.map((item) => <article key={item.requirementId} className="rounded border border-line p-4">
        <h3 className="font-semibold">{item.requirementId}: {item.status.replaceAll("_", " ")}</h3><p>{item.explanation}</p>
        {item.evidence.map((evidence, index) => <blockquote key={index} className="mt-2 border-l-2 border-brand pl-3">{evidence.source}: “{evidence.quote}”</blockquote>)}
      </article>)}
      {([['Strengths', analysis.strengths], ['Clarification questions', analysis.clarificationQuestions], ['Growth suggestions', analysis.growthSuggestions]] as const).map(([heading, items]) => <div key={heading}><h3 className="font-semibold">{heading}</h3><ul className="list-inside list-disc">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}
      <p>{analysis.disclaimer}</p>
    </section>}
  </main>;
}
