"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { copyableBullet, evidence, initialReviews, reviewEvidence, sources, suggestions, suggestionStatus, type Review, type Suggestion } from "./demo";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-700 disabled:cursor-not-allowed disabled:opacity-50";
const labels = { review: "Needs confirmation", blocked: "Blocked · rejected evidence", ready: "Candidate-confirmed" };
const tones = { review: "bg-amber-50 text-amber-900", blocked: "bg-rose-50 text-rose-800", ready: "bg-emerald-50 text-emerald-800" };

export default function ImpactLab() {
  const [reviews, setReviews] = useState(initialReviews);
  const [selected, setSelected] = useState<Suggestion>(suggestions[0]);
  const [notice, setNotice] = useState("Review the fictional evidence to unlock copying.");
  const inspector = useRef<HTMLElement>(null);
  const readyCount = suggestions.filter((item) => suggestionStatus(item, reviews) === "ready").length;

  function inspect(item: Suggestion) {
    setSelected(item);
    inspector.current?.focus();
    inspector.current?.scrollIntoView({ block: "nearest" });
  }

  function review(id: string, state: Review) {
    setReviews((current) => reviewEvidence(current, id, state));
    const claim = evidence.find((item) => item.id === id)?.claim;
    setNotice(`${claim}: ${state === "confirmed" ? "candidate-confirmed in this fictional demo" : state === "rejected" ? "rejected; linked suggestion is blocked from copying" : "returned to needs verification"}.`);
  }

  async function copy(item: Suggestion) {
    const text = copyableBullet(item, reviews);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${item.title}: copied candidate-confirmed demo bullet.`);
    } catch {
      setNotice("Clipboard unavailable. Select the candidate-confirmed bullet text and copy it manually.");
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9fe] font-sans text-slate-900 selection:bg-purple-200">
      <a href="#lab-main" className="sr-only z-50 rounded-lg bg-white p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to Impact Lab</a>
      <header className="border-b border-purple-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href={routes.dashboard} aria-label="ScaleMe dashboard" className="rounded text-2xl font-extrabold tracking-tight text-purple-800 focus-visible:outline-2 focus-visible:outline-purple-700">ScaleMe<span className="text-purple-400">.</span></Link>
          <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold tracking-wider text-purple-800">FICTIONAL DEMO</span>
        </div>
      </header>

      <main id="lab-main" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-purple-700">Your experience. Its real impact.</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Resume Impact Lab</h1>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Stronger bullets start with better evidence. Uncover what you did, inspect every claim, and keep the facts in your hands.</p>
          </div>
          <button className={`${button} shrink-0 border border-purple-200 bg-white text-purple-800 hover:bg-purple-50`} onClick={() => { setReviews(initialReviews()); setSelected(suggestions[0]); setNotice("Demo reset. All claims need confirmation again; copying is locked."); }}>Reset demo <span aria-hidden="true" className="ml-2">↺</span></button>
        </div>

        <div className="mb-8 rounded-2xl border border-purple-200 bg-purple-50 p-5 text-sm leading-6 text-purple-950">
          <strong>Explore a fictional candidate’s experience.</strong> All resume excerpts, answers, and suggestions below are hand-written samples. No live AI, uploads, or saved data. Confirmation is a demo action, not independent verification.
        </div>

        <ol aria-label="How the lab works" className="mb-8 grid gap-3 sm:grid-cols-3">
          {["Compare the wording", "Inspect & confirm evidence", "Copy grounded suggestions"].map((step, i) => <li key={step} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-800">{i + 1}</span>{step}</li>)}
        </ol>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">From task to contribution</h2>
          <p className="text-sm text-slate-600"><span className="font-bold text-purple-800">{readyCount} of {suggestions.length}</span> suggestions ready to copy</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5">
            {suggestions.map((item, index) => {
              const status = suggestionStatus(item, reviews);
              return <article key={item.id} aria-labelledby={`title-${item.id}`} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${selected.id === item.id ? "border-purple-400" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <h3 id={`title-${item.id}`} className="font-bold"><span className="mr-2 text-purple-500">0{index + 1}</span>{item.title}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[status]}`}>{labels[status]}</span>
                </div>
                <div className="grid sm:grid-cols-2">
                  <div className="p-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Before · original resume</p><p className="text-base leading-7 text-slate-600">{item.original}</p></div>
                  <div className="border-t border-purple-100 bg-purple-50/60 p-5 sm:border-l sm:border-t-0"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-800">After · {status === "ready" ? "candidate-confirmed" : status === "blocked" ? "blocked draft" : "unconfirmed draft"}</p><p className="text-base font-medium leading-7 text-purple-950">{item.improved}</p></div>
                </div>
                <div className="space-y-4 p-5">
                  <p className="text-sm text-slate-600">{item.focus}. Every added detail must trace back to a candidate statement.</p>
                  <div className="flex flex-wrap gap-2">
                    <button aria-controls="evidence-inspector" aria-label={`Inspect evidence for ${item.title}`} className={`${button} bg-purple-700 text-white hover:bg-purple-800`} onClick={() => inspect(item)}>Inspect evidence <span aria-hidden="true" className="ml-2">↗</span></button>
                    <button aria-label={`Copy suggestion for ${item.title}`} aria-describedby={`copy-help-${item.id}`} className={`${button} border border-slate-200 text-slate-700 hover:bg-slate-50`} disabled={status !== "ready"} onClick={() => copy(item)}>Copy suggestion</button>
                  </div>
                  <p id={`copy-help-${item.id}`} className="text-xs leading-5 text-slate-500">{status === "ready" ? "All linked facts confirmed by the candidate in this demo. Not externally verified." : status === "blocked" ? "A supporting statement was rejected. Restore and confirm it to unlock copying." : "Copy unlocks when you confirm every linked statement in the evidence inspector."}</p>
                </div>
              </article>;
            })}
          </div>

          <aside ref={inspector} id="evidence-inspector" tabIndex={-1} aria-labelledby="inspector-title" className="min-w-0 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm focus:outline-2 focus:outline-offset-4 focus:outline-purple-600 sm:p-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-700">The evidence behind the words</p>
            <h2 id="inspector-title" className="text-xl font-bold">Evidence inspector</h2>
            <p className="mt-1 text-sm text-slate-600">{selected.title} · FICTIONAL DEMO</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">Review each exact source statement. Confirm only what the fictional candidate can stand behind. Rejected evidence blocks its suggestion.</p>
            <div className="mt-5 space-y-4">
              {selected.evidenceIds.map((id) => {
                const item = evidence.find((entry) => entry.id === id)!;
                const state = reviews[id];
                return <section key={id} aria-label={item.claim} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-500">{sources[item.source].label} · {item.source}</p>
                  <h3 className="mt-2 text-sm font-bold">{item.claim}</h3>
                  <blockquote className="my-3 border-l-2 border-purple-200 pl-3 text-sm leading-6 text-slate-700">“{item.quote}”</blockquote>
                  <p className={`text-xs font-bold ${state === "confirmed" ? "text-emerald-800" : state === "rejected" ? "text-rose-800" : "text-amber-900"}`}>{state === "confirmed" ? "✓ Candidate-confirmed · not externally verified" : state === "rejected" ? "× Rejected · excluded from copying" : "? Needs verification · candidate-reported"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button aria-pressed={state === "confirmed"} className={`${button} border ${state === "confirmed" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-purple-200 text-purple-800 hover:bg-purple-50"}`} onClick={() => review(id, "confirmed")}>Confirm</button>
                    <button aria-pressed={state === "rejected"} className={`${button} border border-rose-200 text-rose-800 hover:bg-rose-50`} onClick={() => review(id, "rejected")}>Reject</button>
                    {state !== "reported" && <button className={`${button} text-slate-600 hover:bg-slate-100`} onClick={() => review(id, "reported")}>Undo review</button>}
                  </div>
                </section>;
              })}
              <section className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-950">Missing evidence · left out of the draft</h3>
                <p className="mt-2 text-sm leading-6 text-amber-950">{selected.missing}</p>
                <p className="mt-2 text-xs leading-5 text-amber-900">Missing facts cannot be confirmed here. Gather evidence first; use the questions below to guide that work.</p>
              </section>
            </div>
          </aside>
        </div>

        <p role="status" aria-live="polite" aria-atomic="true" className="my-6 min-h-12 rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm leading-6 text-purple-900">{notice}</p>

        <section aria-labelledby="grill-title" className="mt-10">
          <div className="mb-5"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-700">Go deeper, stay truthful</p><h2 id="grill-title" className="text-2xl font-bold">Can you defend your bullet?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Targeted grilling questions for each weak original. These are fixed prompts for reflection; this demo does not collect answers.</p></div>
          <div className="grid gap-5 md:grid-cols-2">
            {suggestions.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h3 className="mb-4 font-bold">{item.title}</h3><div className="divide-y divide-slate-100">{item.questions.map((question) => <details key={question.topic} className="group py-3"><summary className="min-h-11 cursor-pointer rounded-lg py-2 text-sm font-semibold text-purple-900 focus-visible:outline-2 focus-visible:outline-purple-700">{question.topic}</summary><p className="pb-2 text-sm leading-6 text-slate-600">{question.question}</p></details>)}</div></div>)}
          </div>
        </section>

        <section aria-labelledby="plan-title" className="mt-8 rounded-2xl border border-purple-200 bg-white p-5 sm:p-7">
          <h2 id="plan-title" className="text-xl font-bold">Your next move</h2>
          <p className="mt-2 text-sm text-slate-600">A practical action plan for the fictional sample, not an assessment of your abilities.</p>
          <div className="mt-5 grid gap-6 md:grid-cols-2">{suggestions.map((item) => <div key={item.id}><h3 className="font-semibold text-purple-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600"><strong>Potential strength to confirm:</strong> {item.strength}</p><p className="mt-2 text-sm leading-6 text-slate-600"><strong>Next action:</strong> {item.next}</p></div>)}</div>
        </section>
        <footer className="mt-10 border-t border-purple-100 pt-5 text-xs leading-6 text-slate-500">FICTIONAL DEMO · Deterministic suggestions, no AI calls. Reviews reset on reload. ScaleMe does not independently verify candidate claims or predict hiring outcomes.</footer>
      </main>
    </div>
  );
}
