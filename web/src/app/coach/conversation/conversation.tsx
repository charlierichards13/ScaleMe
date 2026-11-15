"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CoachError, requestCoach } from "@/lib/coach/client";
import { COACH_LIMITS, type CoachMessage } from "@/lib/coach/schema";
import "./conversation.css";

export default function Conversation() {
  const [token, setToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<CoachError>();
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const task = useRef<{ controller: AbortController; id: number } | null>(null);
  const generation = useRef(0);
  const composer = useRef<HTMLTextAreaElement>(null);
  const code = useRef<HTMLInputElement>(null);
  const locked = busy || history.length > 0;
  const full = history.length >= COACH_LIMITS.messages + 1;

  const reset = useCallback((focus = true) => {
    generation.current++;
    task.current?.controller.abort(); task.current = null;
    setToken(""); setConsent(false); setResume(""); setJob(""); setDraft(""); setHistory([]);
    setBusy(false); setAuthorized(false); setError(undefined); setWaitSeconds(0); setCancelled(false);
    if (focus) requestAnimationFrame(() => code.current?.focus());
  }, []);
  useEffect(() => {
    const exit = () => reset(false);
    window.addEventListener("pagehide", exit);
    return () => { window.removeEventListener("pagehide", exit); reset(false); };
  }, [reset]);
  useEffect(() => {
    if (!waitSeconds) return;
    const timer = setTimeout(() => setWaitSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  function cancel() {
    generation.current++; task.current?.controller.abort(); task.current = null;
    setBusy(false); setAuthorized(false); setCancelled(true);
    requestAnimationFrame(() => composer.current?.focus());
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (task.current || !consent || full || !draft.trim() || waitSeconds > 0) return;
    const id = ++generation.current;
    const controller = new AbortController(); task.current = { id, controller };
    setBusy(true); setError(undefined); setCancelled(false);
    const user: CoachMessage = { role: "user", content: draft.trim() };
    try {
      const result = await requestCoach({ consent: true, messages: [...history, user],
        context: { ...(resume.trim() ? { resume: resume.trim() } : {}), ...(job.trim() ? { job: job.trim() } : {}) } }, token, controller.signal);
      if (generation.current !== id || controller.signal.aborted) return;
      setHistory(h => [...h, user, result.message]); setDraft(""); setAuthorized(true);
    } catch (failure) {
      if (generation.current !== id || controller.signal.aborted) return;
      const failureSafe = failure instanceof CoachError ? failure : new CoachError(0, "The request failed. No reply was added.");
      setError(failureSafe); setWaitSeconds(failureSafe.retryAfter); setAuthorized(false);
    } finally {
      if (generation.current === id) { task.current = null; setBusy(false); requestAnimationFrame(() => composer.current?.focus()); }
    }
  }
  return (
    <section className="coach-conversation" aria-labelledby="conversation-title">
      <Link className="coach-text-link" href="/coach" onClick={() => reset(false)}>← All preparation paths</Link>
      <p className="coach-eyebrow">PRIVATE CAREER PREPARATION</p>
      <h1 id="conversation-title">Talk through your experience.</h1>
      <p>Explore a problem you solved, what you owned, the choices you made and the outcome you can support. Bedrock responses are <strong>unverified coaching advice</strong>, not validated evidence or approved resume bullets.</p>
      <p className="conversation-state" role="status">{busy ? "Sending to the private server…" : authorized ? "Private live AI · server-authorized response" : error?.status === 503 ? "Unavailable · no model response" : "Private preview · access not checked for this request"}</p>
      <div className="conversation-grid">
        <aside className="conversation-settings" aria-labelledby="context-title">
          <h2 id="context-title">You control the context</h2>
          <p>No automatic import. Only text you enter here is submitted. Context locks after the first reply; clear to change it.</p>
          <label htmlFor="coach-code">Private access code</label>
          <input ref={code} id="coach-code" type="password" autoComplete="off" spellCheck={false} maxLength={256} value={token} disabled={busy} onChange={e => { setToken(e.target.value); setAuthorized(false); }} aria-describedby="code-help" />
          <p id="code-help">Owner-distributed code, kept only for this active page. Never paste AWS credentials.</p>
          <label htmlFor="coach-resume">Resume context (optional, {COACH_LIMITS.resumeChars.toLocaleString("en-US")} characters)</label>
          <textarea id="coach-resume" rows={5} maxLength={COACH_LIMITS.resumeChars} value={resume} disabled={locked} onChange={e => setResume(e.target.value)} />
          <label htmlFor="coach-job">Job context (optional, {COACH_LIMITS.jobChars.toLocaleString("en-US")} characters)</label>
          <textarea id="coach-job" rows={4} maxLength={COACH_LIMITS.jobChars} value={job} disabled={locked} onChange={e => setJob(e.target.value)} />
          <label className="conversation-consent"><input id="coach-consent" type="checkbox" checked={consent} disabled={busy} onChange={e => { setConsent(e.target.checked); setAuthorized(false); }} /><span>I approve sending this conversation and optional resume/job text to the server and Amazon Bedrock on each explicit send.</span></label>
          <p>Live inference is off by default. An enabled, configured private server and valid code are required. The owner must review the model, processing region and provider retention policy before personal data. Use fictional text for demos.</p>
          <p>Each send uses the shared paid-model budget. Failed or cancelled calls may still be billed. No browser storage, cookies or saved history. Clear, exit or refresh to remove this session.</p>
          <button className="conversation-secondary" type="button" onClick={() => reset()}>Clear session &amp; access code</button>
        </aside>
        <div className="conversation-panel">
          <h2>Your active conversation</h2>
          <p>Up to six sends per session, 2,000 characters per turn and 24,000 across all context. No calls on page load or automatic retries.</p>
          <div role="log" aria-label="Career coaching transcript" aria-live="polite" aria-relevant="additions" className="conversation-transcript">
            {!history.length && <p className="conversation-empty">Choose one real experience to discuss. Nothing has been sent yet.</p>}
            {history.map((message, index) => <article key={index} className={`conversation-turn conversation-${message.role}`}><h3>{message.role === "user" ? "You" : "Bedrock coach · Unverified advice"}</h3><p>{message.content}</p></article>)}
          </div>
          {cancelled && <p role="status">Request cancelled; your draft is retained. An admitted call may still complete and be billed.</p>}
          {error && <div role="alert" className="conversation-error"><strong>{error.status ? `Request failed (${error.status})` : "Connection or cancellation error"}</strong><p>{error.message}</p>{waitSeconds > 0 && <p>Retry available in {waitSeconds} seconds.</p>}</div>}
          {full ? <p role="status">Session limit reached. Review the advice, then clear to start a new conversation. No history is silently dropped.</p> : <form onSubmit={send} autoComplete="off">
            <label htmlFor="coach-message">Your next message</label>
            <textarea ref={composer} id="coach-message" rows={4} maxLength={COACH_LIMITS.turnChars} value={draft} disabled={busy} onChange={e => { setDraft(e.target.value); setError(undefined); }} aria-describedby="message-help" />
            <p id="message-help">{draft.length} / 2,000 characters · Enter adds a line. Send is always explicit.</p>
            <div className="conversation-actions"><button className="coach-primary" disabled={busy || !consent || !draft.trim() || !token || waitSeconds > 0} type="submit">{busy ? "Sending…" : error?.retryable ? "Retry message" : "Send to private coach"}</button>{busy && <button className="conversation-secondary" type="button" onClick={cancel}>Cancel request</button>}</div>
          </form>}
          <p className="conversation-review">For a source-grounded report and confirmation controls, use the <Link href="/interview/contextual" onClick={() => reset(false)}>contextual interview</Link> or <Link href="/impact-lab" onClick={() => reset(false)}>local Impact Lab</Link>. This conversation is not automatically transferred.</p>
        </div>
      </div>
    </section>
  );
}
