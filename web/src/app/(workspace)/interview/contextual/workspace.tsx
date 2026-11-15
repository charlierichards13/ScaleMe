"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, MessageSquare, Send, ShieldCheck } from "lucide-react";
import { Badge, Card, DemoBadge, buttonStyles } from "@/components/ui/primitives";
import type { FitAnalysis, FitRequest } from "@/lib/ai/schemas";
import type { InterviewResponse, InterviewTurn } from "@/lib/ai/interview-schemas";
import { ConversationError, analyzeContext, nextQuestion, privateRequest } from "@/lib/contextual-interview/client";
import { answerHistory, coachHistory, collectEvidence, emptyDraft, prepareContext, type ContextDraft, type EvidenceHandoff } from "@/lib/contextual-interview/session";

const fieldStyle = `${buttonStyles.focusRing} mt-2 block w-full min-w-0 rounded-xl border border-line bg-surface p-3 text-sm text-ink`;
const primary = `${buttonStyles.primary} disabled:cursor-not-allowed disabled:opacity-50`;
const secondary = `${buttonStyles.secondary} disabled:cursor-not-allowed disabled:opacity-50`;
const statusText = { supported: "Shown in resume", not_evidenced: "Not shown in resume", unclear: "Needs clarification" };
type Operation = "access" | "analysis" | "question";

export function ContextualInterview({ onComplete }: { onComplete?: (evidence: EvidenceHandoff) => void } = {}) {
  const [draft, setDraft] = useState<ContextDraft>({ ...emptyDraft });
  const [token, setToken] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [consent, setConsent] = useState(false);
  const [context, setContext] = useState<FitRequest | null>(null);
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [history, setHistory] = useState<InterviewTurn[]>([]);
  const [turn, setTurn] = useState<InterviewResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [started, setStarted] = useState(false);
  const [handoff, setHandoff] = useState<EvidenceHandoff | null>(null);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [error, setError] = useState<ConversationError | null>(null);
  const [retry, setRetry] = useState<Operation | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const operation = useRef<{ controller: AbortController; id: number } | null>(null);
  const sequence = useRef(0);
  const latest = useRef<HTMLDivElement>(null);
  const answerField = useRef<HTMLTextAreaElement>(null);
  const answers = history.filter(t => t.role === "candidate").length;
  const isClosing = !!turn && turn.canFinish && !turn.coachMessage.includes("?");

  const clear = useCallback(() => {
    operation.current?.controller.abort(); sequence.current++; operation.current = null;
    setDraft({ ...emptyDraft }); setToken(""); setUnlocked(false); setConsent(false);
    setContext(null); setAnalysis(null); setHistory([]); setTurn(null); setAnswer("");
    setStarted(false); setHandoff(null); setBusy(null); setError(null); setRetry(null);
    setCooldown(0); setConfirmClear(false);
  }, []);

  useEffect(() => {
    // Next.js can retain inactive pages. Erase sensitive state when effects deactivate,
    // and on full-page navigation (including browser back/forward cache).
    window.addEventListener("pagehide", clear);
    return () => { window.removeEventListener("pagehide", clear); clear(); };
  }, [clear]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!started) return;
    latest.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    if (turn && !isClosing && !busy) answerField.current?.focus({ preventScroll: true });
  }, [history.length, turn, busy, started, isClosing]);

  function showValidation(message: string) {
    setError(new ConversationError("VALIDATION", message));
    setRetry(null);
  }

  async function run(kind: Operation, work: (signal: AbortSignal) => Promise<unknown>, done: (value: unknown) => void) {
    if (operation.current || cooldown > 0) return;
    const controller = new AbortController();
    const id = ++sequence.current;
    operation.current = { controller, id };
    setBusy(kind); setError(null); setRetry(null);
    try {
      const value = await work(controller.signal);
      if (id === sequence.current) done(value);
    } catch (caught) {
      if (id !== sequence.current) return;
      const failure = caught instanceof ConversationError ? caught : new ConversationError("REQUEST_FAILED", "The request failed. Your session is retained.", true);
      setError(failure); setRetry(failure.retryable ? kind : null); setCooldown(failure.retryAfter);
    } finally {
      if (id === sequence.current) { operation.current = null; setBusy(null); }
    }
  }

  function unlock(event?: FormEvent) {
    event?.preventDefault();
    void run("access", signal => privateRequest("/api/practice/access", token, undefined, signal), result => {
      if ((result as { available?: boolean })?.available === true) setUnlocked(true);
      else showValidation("Private access could not be verified.");
    });
  }

  function analyze(event?: FormEvent) {
    event?.preventDefault();
    if (!unlocked || !consent) return showValidation("Unlock private access and approve sending this context before analyzing.");
    let prepared: FitRequest;
    try { prepared = prepareContext(draft); }
    catch (caught) { return showValidation((caught as Error).message); }
    // Snapshot is replaced only by an explicit new analysis; never while interviewing.
    setContext(prepared);
    void run("analysis", signal => analyzeContext(prepared, token, signal), result => setAnalysis(result as FitAnalysis));
  }

  function ask(requestHistory: InterviewTurn[] = history) {
    if (!context || !analysis) return;
    setStarted(true);
    void run("question", signal => nextQuestion(context, analysis, requestHistory, token, signal), result => {
      const next = result as InterviewResponse;
      setTurn(next); setHistory([...requestHistory, coachHistory(next)]);
    });
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (busy || cooldown || !turn || isClosing) return;
    let next: InterviewTurn[];
    try { next = answerHistory(history, answer); }
    catch (caught) { return showValidation((caught as Error).message); }
    setHistory(next); setAnswer(""); setTurn(null);
    ask(next);
  }

  function cancel() {
    operation.current?.controller.abort(); sequence.current++; operation.current = null;
    setRetry(busy); setBusy(null);
    setError(new ConversationError("CANCELLED", "Request cancelled. A request already received by the server may still complete. Your submitted answers are retained.", true));
  }

  function finish() {
    if (!context || !analysis || !answers || answer.trim()) return;
    operation.current?.controller.abort(); sequence.current++; operation.current = null;
    setBusy(null); setError(null); setRetry(null);
    const evidence = collectEvidence(context, analysis, history);
    setHandoff(evidence);
    setToken(""); setUnlocked(false);
    onComplete?.(evidence);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <Badge tone="brand">Contextual interview · private preview</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Turn your experience into evidence</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Bring your resume and a target role. Review each requirement, then practice with questions that use your experience and previous answers.</p>
        </div>
        <Link href="/interview" className={buttonStyles.secondary}>Fictional practice demo</Link>
      </header>

      <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted" aria-label="Interview stages">
        {["1. Add context", "2. Review requirements", "3. Conversation", "4. Review evidence"].map((label, i) => (
          <span key={label} className={`rounded-full px-3 py-2 ${i === (handoff ? 3 : started ? 2 : analysis ? 1 : 0) ? "bg-brand-soft text-brand-strong" : "bg-surface"}`}>{label}</span>
        ))}
      </div>

      {!unlocked && !analysis && (
        <Card aria-labelledby="access-title">
          <div className="flex gap-3"><LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden="true" /><div>
            <h2 id="access-title" className="font-semibold">Private live AI access</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Live AI is off by default. An authorized private environment and its owner-provided access code are required. Checking access is free.</p>
          </div></div>
          <form onSubmit={unlock} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm font-medium">Private access code
              <input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} maxLength={256} className={fieldStyle} disabled={!!busy} required />
            </label>
            <button className={primary} disabled={!!busy || !token.trim()} type="submit">Check private access</button>
          </form>
        </Card>
      )}

      {!analysis && (
        <Card aria-labelledby="context-title">
          <h2 id="context-title" className="text-lg font-semibold">Your resume, your target role</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Text stays in this page until you explicitly send it. Leaving or refreshing clears the session. No uploads or account storage are used.</p>
          <form onSubmit={analyze} className="mt-5 space-y-4">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="min-w-0 text-sm font-semibold"><label htmlFor="context-resume">Resume text</label>
                <textarea id="context-resume" aria-describedby="resume-count" rows={10} maxLength={30000} required value={draft.resume} onChange={e => setDraft({ ...draft, resume: e.target.value })} className={fieldStyle} disabled={!!busy} placeholder="Paste the experience you want to discuss…" />
                <span id="resume-count" className="mt-1 block text-xs font-normal text-muted">{draft.resume.length.toLocaleString()} / 30,000 characters</span>
              </div>
              <div className="min-w-0 space-y-4">
                <label className="block text-sm font-semibold">Target role title
                  <input maxLength={200} required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={fieldStyle} disabled={!!busy} placeholder="e.g. Software engineering intern" />
                </label>
                <label className="block text-sm font-semibold">Job description
                  <textarea rows={6} maxLength={20000} required value={draft.job} onChange={e => setDraft({ ...draft, job: e.target.value })} className={fieldStyle} disabled={!!busy} placeholder="Paste the job description…" />
                </label>
              </div>
            </div>
            <div className="block text-sm font-semibold"><label htmlFor="context-requirements">Required skills or responsibilities · one per line</label>
              <textarea id="context-requirements" rows={4} required value={draft.requirements} onChange={e => setDraft({ ...draft, requirements: e.target.value })} className={fieldStyle} disabled={!!busy} placeholder={"Copy the requirements you want to assess from the job description.\nKeep each requirement on a separate line."} aria-describedby="requirements-help" maxLength={30029} />
              <span id="requirements-help" className="mt-1 block text-xs font-normal leading-5 text-muted">Choose 1–30 requirements, up to 1,000 characters each. These stay fixed throughout the analysis and interview.</span>
            </div>
            <label className="flex items-start gap-3 rounded-xl bg-canvas p-4 text-sm leading-6">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-brand" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={!!busy} />
              <span>I authorize sending this resume, job and requirements to Amazon Bedrock for live analysis. Each AI request may incur charges. During the interview, previous questions and my answers will also be sent. I have permission to use this data in this private environment.</span>
            </label>
            <p className="text-xs leading-5 text-muted">Provider retention and logging depend on the private environment’s reviewed settings. Use fictional data until its owner has approved handling personal data.</p>
            <button type="submit" className={primary} disabled={!unlocked || !consent || !!busy || cooldown > 0}>Analyze requirements with live AI <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </form>
        </Card>
      )}

      {analysis && context && !handoff && (
        <div className={started ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]" : "space-y-5"}>
          {started && (
            <Card aria-labelledby="conversation-title" className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="conversation-title" className="flex items-center gap-2 text-lg font-semibold"><MessageSquare className="h-5 w-5 text-brand" aria-hidden="true" /> Your interview</h2>
                <Badge tone="info">Live AI · {answers} answers</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">It is fine to say “not measured” or that you haven’t done something.</p>
              <div role="log" aria-label="Interview conversation" aria-live="polite" aria-relevant="additions" className="mt-5 max-h-[32rem] space-y-4 overflow-y-auto overscroll-contain pr-1">
                {history.map((message, i) => (
                  <article key={i} className={`rounded-2xl p-4 ${message.role === "candidate" ? "ml-4 bg-brand-soft" : "mr-4 border border-line bg-canvas"}`}>
                    <p className="text-xs font-semibold text-brand-strong">{message.role === "coach" ? "ScaleMe coach" : "You"}</p>
                    {message.targetRequirementId && <p className="mt-1 text-xs text-muted">Discussing: {context.job.requirements?.find(r => r.id === message.targetRequirementId)?.description}</p>}
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{message.content}</p>
                  </article>
                ))}
                <div ref={latest} />
              </div>
              {turn && !isClosing && (
                <form onSubmit={send} className="mt-5 border-t border-line pt-4">
                  <label className="text-sm font-semibold" htmlFor="interview-answer">Your answer</label>
                  <textarea id="interview-answer" ref={answerField} rows={4} className={fieldStyle} maxLength={2000} value={answer} onChange={e => setAnswer(e.target.value)} disabled={!!busy} aria-describedby="answer-help" />
                  <p id="answer-help" className="mt-1 text-xs text-muted">{answer.length} / 2,000 characters · Enter adds a new line.</p>
                  <button type="submit" className={`${primary} mt-3`} disabled={!!busy || !answer.trim() || cooldown > 0}><Send className="h-4 w-4" aria-hidden="true" /> Send answer & get AI follow-up</button>
                </form>
              )}
              {answers > 0 && <div className="mt-4 border-t border-line pt-4">
                <button type="button" className={secondary} onClick={finish} disabled={!!answer.trim()}>{isClosing || turn?.canFinish ? "Finish & review evidence" : "End early & review evidence"}</button>
                {answer.trim() && <p className="mt-2 text-xs text-muted">Send your draft or clear it before finishing. Only submitted answers are collected.</p>}
              </div>}
            </Card>
          )}
          <Card aria-labelledby="analysis-title" className="min-w-0">
            <Badge tone="success"><ShieldCheck className="h-3 w-3" aria-hidden="true" /> Live analysis</Badge>
            <h2 id="analysis-title" className="mt-3 text-lg font-semibold">{context.job.title}</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{analysis.summary}</p>
            <div className="mt-4 space-y-3">
              {analysis.assessments.map(item => (
                <details key={item.requirementId} className="rounded-xl border border-line p-3" open={!started}>
                  <summary className="cursor-pointer text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{context.job.requirements?.find(r => r.id === item.requirementId)?.description}
                    <span className="mt-1 block text-xs font-medium text-muted">{statusText[item.status]}</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.explanation}</p>
                  {item.evidence.map((e, i) => <blockquote key={i} className="mt-2 border-l-2 border-brand/40 pl-3 text-sm leading-6 [overflow-wrap:anywhere]"><span className="block text-xs font-semibold text-muted">{e.source === "resume" ? "Resume quote" : "Job requirement quote"}</span>“{e.quote}”</blockquote>)}
                </details>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">{analysis.disclaimer}</p>
            {!started && <button type="button" className={`${primary} mt-5`} onClick={() => ask([])} disabled={!!busy || cooldown > 0}>Start contextual interview <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
            <p className="mt-3 text-xs leading-5 text-muted">Each follow-up uses your original context and the conversation so far. Fit statuses remain unchanged until reassessment.</p>
          </Card>
        </div>
      )}

      {handoff && <Card aria-labelledby="evidence-title">
        <CheckCircle2 className="h-7 w-7 text-brand" aria-hidden="true" />
        <h2 id="evidence-title" className="mt-3 text-xl font-semibold">Your evidence, collected</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{handoff.answers.length} submitted answers are ready for the forthcoming reassessment engine. They are candidate-reported, not independently verified. No requirement status has changed.</p>
        <div className="mt-5 space-y-4">{handoff.answers.map(item => <article key={item.id} className="rounded-xl border border-line p-4">
          <Badge tone="info">Candidate-reported</Badge>
          {item.targetRequirementId && <p className="mt-2 text-sm font-semibold">{handoff.context.job.requirements?.find(r => r.id === item.targetRequirementId)?.description}</p>}
          <p className="mt-2 text-xs leading-6 text-muted">Coach: {item.question}</p>
          <blockquote className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{item.quote}</blockquote>
        </article>)}</div>
        <p className="mt-4 text-sm leading-6 text-muted">Reassessment is pending integration. This evidence remains only in this page; refreshing or leaving clears it.</p>
      </Card>}

      {busy && <Card aria-live="polite" aria-busy="true"><div className="flex flex-wrap items-center gap-3">
        <LoaderCircle className="h-5 w-5 animate-spin text-brand motion-reduce:animate-none" aria-hidden="true" />
        <p className="flex-1 text-sm">{busy === "access" ? "Checking private access…" : busy === "analysis" ? "Analyzing your requirements…" : "Preparing a question from your context…"}</p>
        <button type="button" className={secondary} onClick={cancel}>Cancel request</button>
      </div></Card>}
      {error && <Card role="alert" className="border-amber-300 bg-amber-50">
        <p className="text-sm leading-6">{error.message}</p>
        {cooldown > 0 && <p className="mt-2 text-sm">Retry available in {cooldown} seconds.</p>}
        {retry && <button type="button" className={`${secondary} mt-3`} disabled={!!busy || cooldown > 0} onClick={() => retry === "access" ? unlock() : retry === "analysis" ? analyze() : ask(history)}>Retry {retry === "question" ? "question" : retry}</button>}
      </Card>}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <p className="max-w-xl text-xs leading-5 text-muted"><DemoBadge /> <Link className="ml-2 underline" href="/interview">Open the separate fictional practice</Link> · Fixed prompts, no AI calls.</p>
        <button type="button" className={buttonStyles.ghost} onClick={() => setConfirmClear(true)}>Clear session & access code</button>
      </footer>
      {confirmClear && <Card role="alert" aria-label="Clear session confirmation">
        <p className="text-sm leading-6">Clear all pasted context, submitted answers, drafts and the private access code? Nothing is saved and this cannot be undone.</p>
        <div className="mt-3 flex flex-wrap gap-3"><button className={secondary} onClick={() => setConfirmClear(false)} type="button">Keep session</button><button className={primary} onClick={clear} type="button">Clear everything</button></div>
      </Card>}
    </div>
  );
}
