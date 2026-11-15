"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { analyzeLocally, fromCandidateTurn, fromFitAnalysis, requirementLines, type FitHandoff } from "@/lib/evidence-ledger/adapters";
import { EvidenceLedger } from "@/lib/evidence-ledger/ledger";
import type { ImpactProposal, Requirement } from "@/lib/evidence-ledger/types";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-700 disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} bg-purple-700 text-white hover:bg-purple-800`;
const secondary = `${button} border border-purple-200 bg-white text-purple-800 hover:bg-purple-50`;
const input = "mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-purple-700 disabled:bg-slate-100";
const card = "rounded-2xl border border-purple-100 bg-white p-5 shadow-sm sm:p-6";
const statuses = { supported: "Supported", unclear: "Unclear", not_evidenced: "Not evidenced" };
const sample = {
  resume: "Built an internal employee portal for company resources.\nWorked on a CSV import tool with custom error reporting.",
  job: "Required: Build web applications.\nRequired: Test web applications.\nRequired: Work on CSV import tools.\nRequired: Validate CSV imports.\nPreferred: Automate regression tests.",
};

type ProposalLink = { originalId: string; answerId: string };
type Workspace = { ledger: EvidenceLedger; links: ProposalLink[] };

/** Existing Impact Lab route, now processing actual inputs locally. A future
 * Fit Explorer parent can pass v0.1 data through initialFit without a new API. */
export default function ImpactLab({ initialFit }: { initialFit?: FitHandoff } = {}) {
  const [resume, setResume] = useState(initialFit?.request.resume.text ?? "");
  const [job, setJob] = useState(initialFit?.request.job.text ?? "");
  const [requirements, setRequirements] = useState<Requirement[]>(initialFit?.request.job.requirements ?? []);
  const [workspace, setWorkspace] = useState<Workspace | null>(() => {
    if (!initialFit) return null;
    try { return { ledger: fromFitAnalysis(initialFit.request, initialFit.analysis), links: [] }; }
    catch { return null; }
  });
  const [isSample, setIsSample] = useState(false);
  const [target, setTarget] = useState("");
  const [originalId, setOriginalId] = useState("");
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("Paste a resume and job description to begin. Nothing is sent or saved.");
  const [error, setError] = useState("");
  const view = workspace?.ledger.view();
  const chosenTarget = target || view?.after.find((a) => a.status !== "supported")?.requirementId || view?.requirements[0].id || "";
  const originalEvidence = view?.evidence.filter((e) => view.sources.find((s) => s.id === e.sourceId)?.kind === "resume") ?? [];
  const chosenOriginal = originalId || originalEvidence[0]?.id || "";
  const original = originalEvidence.find((e) => e.id === chosenOriginal);
  const proposals: (ProposalLink & { proposal: ImpactProposal })[] = [];
  if (workspace) for (const link of workspace.links) {
    try { proposals.push({ ...link, proposal: workspace.ledger.proposeImpact(link.originalId, link.answerId) }); }
    catch { /* A subsequent contradiction blocks the former proposal. Keep its source in the ledger. */ }
  }

  function reset() {
    setWorkspace(null); setRequirements([]); setResume(""); setJob("");
    setAnswer(""); setTarget(""); setOriginalId(""); setIsSample(false); setError("");
    setNotice("Workspace cleared. Paste new inputs to begin.");
  }
  function prepare(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      setRequirements(requirementLines(job));
      setNotice("Review each requirement and its importance before starting. The inventory freezes when you assess the resume.");
    } catch { setError("Enter 1–30 requirement sentences or lines, up to 1,000 characters each and 20,000 characters total."); }
  }
  function assess() {
    setError("");
    try {
      const result = analyzeLocally(resume, job, requirements);
      setWorkspace({ ledger: result.ledger, links: [] });
      setTarget(""); setOriginalId("");
      setNotice("Baseline created from your inputs. Choose a requirement and describe what you personally did.");
    } catch { setError("The baseline could not be validated. Check the resume (1–30,000 characters), job and requirement inventory. Repeated ambiguous citations may need distinct source wording."); }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!workspace || !view) return;
    setError("");
    try {
      const count = view.sources.filter((s) => s.kind === "interview").length;
      const id = `candidate-turn-${count + 1}`;
      const subjectId = original ? view.sources.find((s) => s.id === original.sourceId)!.subjectId : view.sources[0].subjectId;
      const ledger = workspace.ledger.reassess(fromCandidateTurn({ id, role: "candidate", content: answer,
        targetRequirementId: chosenTarget, subjectId }));
      const after = ledger.view();
      const links = [...workspace.links];
      let proposed = false;
      if (original) {
        try {
          ledger.proposeImpact(original.id, `answer:${id}`);
          links.push({ originalId: original.id, answerId: `answer:${id}` }); proposed = true;
        } catch { /* Unresolved answers must not produce a copyable suggestion. */ }
      }
      setWorkspace({ ledger, links }); setAnswer("");
      const status = after.after.find((a) => a.requirementId === chosenTarget)!.status;
      setNotice(`${id} recorded exactly. ${statuses[status]}. ${proposed ? "A source-grounded proposal is ready for your review." : "No new bullet proposal. Give a specific action, what you worked on, and how it relates to this requirement. Contradictions need clarification."}`);
    } catch { setError("Answer rejected. Enter 1–4,000 characters, use an existing requirement, and keep the session to 20 answers. No result was changed."); }
  }
  function review(evidenceId: string, confirmed: boolean) {
    if (!workspace) return;
    setWorkspace({ ...workspace, ledger: workspace.ledger.reviewEvidence(evidenceId, confirmed) });
    setNotice(confirmed ? "Statement candidate-confirmed. This is not independent verification." : "Confirmation removed. Linked copying is locked until all statements are confirmed.");
  }
  async function copy(link: ProposalLink) {
    if (!workspace) return;
    const text = workspace.ledger.copyableImpact(link.originalId, link.answerId);
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setNotice("Candidate-confirmed wording copied."); }
    catch { setNotice("Clipboard unavailable. Select the candidate-confirmed wording and copy it manually."); }
  }

  return <div className="min-h-screen bg-[#faf9fe] font-sans text-slate-900 selection:bg-purple-200">
    <a href="#lab-main" className="sr-only z-50 rounded-lg bg-white p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to Impact Lab</a>
    <header className="border-b border-purple-100 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href={routes.dashboard} className="rounded text-2xl font-extrabold tracking-tight text-purple-800 focus-visible:outline-2 focus-visible:outline-purple-700">ScaleMe<span className="text-purple-400">.</span></Link>
      <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold tracking-wider text-purple-800">{isSample ? "FICTIONAL SAMPLE · LOCAL PROCESSING" : "LOCAL PROCESSING · NO AI CALLS"}</span>
    </div></header>
    <main id="lab-main" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div className="max-w-2xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-purple-700">Your experience. Its real impact.</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Resume Impact Lab</h1>
        <p className="mt-4 leading-7 text-slate-600">Find evidence missing from your resume, inspect what changed, and review stronger wording grounded in your own statements.</p>
      </div><button className={secondary} onClick={reset}>Clear workspace</button></div>
      <p className="mb-7 rounded-2xl border border-purple-200 bg-purple-50 p-5 text-sm leading-6 text-purple-950">Text stays in this page’s memory and is cleared on reload. Local rules can miss relevant wording and misunderstand context. All support is <strong>candidate-reported</strong>, never independently verified. Coverage describes documented evidence, not hiring probability.</p>
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
      {!workspace && <section className={card} aria-labelledby="input-title">
        <h2 id="input-title" className="text-xl font-bold">1. Start with your resume and target role</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Paste text. Put one job requirement per line where possible. Review required/preferred importance before assessing.</p>
        <form onSubmit={prepare} className="mt-5 space-y-5">
          <div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-semibold">Resume text<textarea className={input} rows={8} required maxLength={30_000} value={resume} onChange={(e) => { setResume(e.target.value); setIsSample(false); }} /></label>
            <label className="text-sm font-semibold">Job description<textarea className={input} rows={8} required maxLength={20_000} value={job} onChange={(e) => { setJob(e.target.value); setRequirements([]); setIsSample(false); }} /></label></div>
          <div className="flex flex-wrap gap-3"><button className={primary} type="submit">Review requirements</button><button className={secondary} type="button" onClick={() => { setResume(sample.resume); setJob(sample.job); setRequirements([]); setIsSample(true); setError(""); setNotice("Fictional sample loaded into the same input workflow. Review its requirements to start."); }}>Load fictional sample</button></div>
        </form>
        {!!requirements.length && <div className="mt-7 border-t border-purple-100 pt-5"><h3 className="font-bold">Freeze your requirement inventory</h3><p className="mt-2 text-sm leading-6 text-slate-600">Choose importance explicitly. Unspecified requirements do not enter the required denominator. To change this inventory later, clear the workspace and create a new baseline.</p>
          <div className="my-5 space-y-3">{requirements.map((r) => <div key={r.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><p className="break-words text-sm leading-6"><span className="font-bold text-purple-800">{r.id}</span> · {r.description}</p><label className="text-xs font-semibold">Importance for {r.id}<select className={input} value={r.importance} onChange={(e) => setRequirements(requirements.map((item) => item.id === r.id ? { ...item, importance: e.target.value as Requirement["importance"] } : item))}><option value="required">Required</option><option value="preferred">Preferred</option><option value="unspecified">Unspecified</option></select></label></div>)}</div>
          <button className={primary} onClick={assess}>Assess resume locally</button>
        </div>}
      </section>}
      {workspace && view && <>
        <section className={`${card} mb-6`} aria-labelledby="coverage-title"><h2 id="coverage-title" className="text-xl font-bold">2. Evidence before and after</h2>
          {initialFit && <p className="mt-2 text-sm leading-6 text-slate-600">Imported fit evidence was revalidated with the local policy. Unsupported citations can make this baseline stricter than the original fit display.</p>}
          <p className="mt-3 text-2xl font-bold text-purple-900" data-testid="coverage">{view.coverage.before.supported} of {view.coverage.before.total} → {view.coverage.after.supported} of {view.coverage.after.total} required requirements supported</p>
          {!view.coverage.after.total && <p className="mt-2 text-sm text-amber-900">No requirements were marked required; the denominator is zero. Clear the workspace to revise importance.</p>}
          <p className="mt-2 break-words text-xs leading-6 text-slate-500">Fixed required IDs: {view.coverage.before.requiredRequirementIds.join(", ") || "none"}. Not evidenced means not shown by this assessment, not that you lack the skill.</p>
          <div className="mt-5 space-y-3">{view.requirements.map((r) => {
            const before = view.before.find((a) => a.requirementId === r.id)!;
            const after = view.after.find((a) => a.requirementId === r.id)!;
            return <details key={r.id} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer break-words text-sm leading-7 focus-visible:outline-2 focus-visible:outline-purple-700"><strong>{r.id} · {r.description}</strong> ({r.importance})<br /><span className="text-purple-800">{statuses[before.status]} → {statuses[after.status]}</span></summary>
              {!after.evidenceIds.length && <p className="mt-3 text-sm text-slate-600">No candidate evidence linked.</p>}
              {after.evidenceIds.map((id) => { const evidence = view.evidence.find((e) => e.id === id)!; const source = view.sources.find((s) => s.id === evidence.sourceId)!;
                return <div key={id} className="mt-4 border-t border-slate-100 pt-3"><p className="break-words text-xs leading-6 text-slate-500">{source.kind} · {source.id} · offsets {evidence.start}–{evidence.end} · {evidence.review.replaceAll("_", " ")} · not independently verified</p><blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-purple-200 pl-3 text-sm leading-6">{evidence.quote}</blockquote><details className="mt-2"><summary className="cursor-pointer text-xs text-purple-800">Inspect full original source</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6">{source.text}</pre></details></div>;
              })}
            </details>;
          })}</div>
        </section>
        <section className={`${card} mb-6`} aria-labelledby="answer-title"><h2 id="answer-title" className="text-xl font-bold">3. Uncover a specific contribution</h2>
          <form onSubmit={submit} className="mt-4 space-y-5"><div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-semibold">Target requirement<select className={input} value={chosenTarget} onChange={(e) => setTarget(e.target.value)}>{view.requirements.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.description}</option>)}</select></label>
            <label className="text-sm font-semibold">Original experience this answer expands<select className={input} value={chosenOriginal} onChange={(e) => setOriginalId(e.target.value)}>{!originalEvidence.length && <option value="">No supported original excerpt available</option>}{originalEvidence.map((e) => <option key={e.id} value={e.id}>{e.quote}</option>)}</select></label></div>
            <p className="rounded-xl bg-purple-50 p-4 text-sm leading-6 text-purple-950">For “{view.requirements.find((r) => r.id === chosenTarget)?.description}”, what did you personally do, what did you work on, and how did you check the result? State any limits or uncertainty.</p>
            <label className="block text-sm font-semibold">Your answer<textarea className={input} rows={5} required maxLength={4_000} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Describe a specific action and concrete details. Leave unmeasured outcomes unknown." /></label>
            <button className={primary} type="submit">Reassess with this answer</button>
          </form>
        </section>
        <section className={`${card} mb-6`} aria-labelledby="proposals-title"><h2 id="proposals-title" className="text-xl font-bold">4. Review grounded wording</h2><p className="mt-2 text-sm leading-6 text-slate-600">The conservative backup combines exact source sentences. Confirm each linked statement before copying. Confirmation does not increase coverage or verify facts externally.</p>
          {!proposals.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6">No supported proposal yet. A specific relevant answer and a supported original excerpt are needed. Vague answers, unknown vocabulary and contradictions may need clarification.</p>}
          <div className="mt-5 space-y-5">{proposals.map((link) => <article key={link.answerId} className="rounded-xl border border-purple-200 p-4"><div className="grid gap-5 sm:grid-cols-2"><div><h3 className="text-xs font-bold uppercase text-slate-500">Original</h3><p className="mt-2 break-words text-sm leading-7">{link.proposal.original}</p></div><div><h3 className="text-xs font-bold uppercase text-purple-800">Proposed · {link.proposal.reviewStatus === "candidate_confirmed" ? "candidate-confirmed" : "needs review"}</h3><p className="mt-2 break-words text-sm font-medium leading-7 text-purple-950">{link.proposal.improved}</p></div></div>
            <div className="mt-4 space-y-3">{link.proposal.supportingEvidence.map((e) => <label key={e.id} className="flex min-h-11 items-start gap-3 rounded-lg bg-purple-50 p-3 text-sm leading-6"><input className="mt-1 size-5 shrink-0 accent-purple-700" type="checkbox" checked={e.review === "candidate_confirmed"} onChange={(event) => review(e.id, event.target.checked)} /><span className="min-w-0 break-words">I confirm this exact statement: “{e.quote}”<span className="block text-xs text-slate-500">{e.sourceId} · {e.review.replaceAll("_", " ")} · not independently verified</span></span></label>)}</div>
            <ul className="my-4 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">{link.proposal.followUpQuestions.map((q) => <li key={q}>{q}</li>)}</ul><button className={secondary} disabled={link.proposal.reviewStatus !== "candidate_confirmed"} onClick={() => copy(link)}>Copy suggestion</button>
          </article>)}</div>
        </section>
        <section className={card} aria-labelledby="plan-title"><h2 id="plan-title" className="text-xl font-bold">Your next steps</h2><div className="mt-4 grid gap-5 md:grid-cols-2"><div><h3 className="font-semibold text-purple-900">Documented strengths</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{view.after.filter((a) => a.status === "supported").map((a) => <li key={a.requirementId}>{view.requirements.find((r) => r.id === a.requirementId)?.description} · candidate-reported</li>)}</ul></div><div><h3 className="font-semibold text-purple-900">Evidence to clarify</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">{view.after.filter((a) => a.status !== "supported").map((a) => <li key={a.requirementId}>If you have experience with “{view.requirements.find((r) => r.id === a.requirementId)?.description}”, provide a specific example. Otherwise, consider a practice project.</li>)}</ul></div></div><p className="mt-5 text-sm leading-6 text-slate-600">Find source records before claiming measured outcomes. Never add a percentage, technology, employer or achievement just because the job asks for it.</p></section>
      </>}
      <p role="status" aria-live="polite" aria-atomic="true" className="my-6 min-h-12 rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm leading-6 text-purple-900">{notice}</p>
      <footer className="mt-10 border-t border-purple-100 pt-5 text-xs leading-6 text-slate-500">Local evidence workflow · No uploads, storage or model calls. Fit Explorer and interview API handoffs require coordinated integration. Reviews reset when this page is cleared or reloaded.</footer>
    </main>
  </div>;
}
