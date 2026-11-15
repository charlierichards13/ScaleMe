"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  FlaskConical,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { analyzeFit, FitClientError, type FitResult } from "@/lib/fit/client";
import {
  draftLimits,
  emptyDraft,
  validateDraft,
  type DraftErrors,
  type FitDraft,
} from "@/lib/fit/draft";
import { ApiResults } from "./api-results";
import OfflineExplorer from "./offline-explorer";
import "./fit-app.css";

export default function FitExplorer() {
  const demo = useSearchParams().get("demo") === "true";
  const [draft, setDraft] = useState<FitDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [prepared, setPrepared] = useState(false);
  const [walkthrough, setWalkthrough] = useState(false);

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validateDraft(draft);
    setErrors(next);
    setPrepared(!Object.keys(next).length);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(`fit-${first}`)?.focus();
  }
  function edit(key: keyof FitDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPrepared(false);
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  return (
    <div className="fit-app">
      <a className="fit-app-skip" href="#fit-main">
        Skip to fit preparation
      </a>
      <header className="fit-app-header">
        <Link href="/fit" className="fit-app-back">
          <ArrowLeft size={17} aria-hidden="true" /> Career workspace
        </Link>
        <nav aria-label="Career preparation">
          <span aria-current="page">Fit Evidence Explorer</span>
          <Link href="/impact-lab">
            Resume Impact Lab <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </header>
      <main id="fit-main" tabIndex={-1} className="fit-app-main">
        <div className="fit-app-intro">
          <div>
            <p className="fit-app-eyebrow">
              <Scale size={16} aria-hidden="true" /> UNDERSTAND YOUR FIT
            </p>
            <h1>
              Turn experience into
              <br />
              clearer evidence.
            </h1>
            <p>
              See what a role asks for, what your resume shows,
              <br className="fit-app-wide" /> and which questions are worth
              asking next.
            </p>
          </div>
          <span className="fit-app-availability">
            <LockKeyhole size={15} aria-hidden="true" /> Live analysis coming
            later
          </span>
        </div>
        <div className="fit-app-safety">
          <ShieldCheck size={21} aria-hidden="true" />
          <p>
            <strong>Your drafts stay in this page’s memory.</strong> Nothing you
            paste is sent for analysis or saved to browser storage. Use Clear
            drafts to remove it. Use fictional text while this feature is being
            prepared.
          </p>
        </div>
        <div className="fit-app-workspace">
          <section className="fit-app-panel" aria-labelledby="inputs-title">
            <div className="fit-app-panel-heading">
              <span className="fit-app-step">01</span>
              <div>
                <h2 id="inputs-title">Prepare your inputs</h2>
                <p>Text only · Local draft</p>
              </div>
              <FileText size={21} aria-hidden="true" />
            </div>
            <form noValidate autoComplete="off" onSubmit={prepare}>
              <label className="fit-app-label" htmlFor="fit-resume">
                Resume text
              </label>
              <p id="fit-resume-help" className="fit-app-help">
                Paste the experience you want to review. PDF upload is not
                available yet.
              </p>
              <textarea
                id="fit-resume"
                value={draft.resume}
                maxLength={draftLimits.resume}
                rows={8}
                placeholder="Projects, experience, skills…"
                onChange={(e) => edit("resume", e.target.value)}
                aria-invalid={!!errors.resume}
                aria-describedby={`fit-resume-help fit-resume-count${errors.resume ? " fit-resume-error" : ""}`}
              />
              <FieldFeedback
                name="resume"
                value={draft.resume}
                error={errors.resume}
              />
              <label className="fit-app-label" htmlFor="fit-title">
                Target job title
              </label>
              <input
                id="fit-title"
                value={draft.title}
                maxLength={draftLimits.title}
                placeholder="e.g. Frontend Engineer Intern"
                onChange={(e) => edit("title", e.target.value)}
                aria-invalid={!!errors.title}
                aria-describedby={`fit-title-count${errors.title ? " fit-title-error" : ""}`}
              />
              <FieldFeedback
                name="title"
                value={draft.title}
                error={errors.title}
              />
              <label className="fit-app-label" htmlFor="fit-job">
                Job description
              </label>
              <p id="fit-job-help" className="fit-app-help">
                Paste the role’s requirements. Job links are not fetched.
              </p>
              <textarea
                id="fit-job"
                value={draft.job}
                maxLength={draftLimits.job}
                rows={7}
                placeholder="Responsibilities and requirements…"
                onChange={(e) => edit("job", e.target.value)}
                aria-invalid={!!errors.job}
                aria-describedby={`fit-job-help fit-job-count${errors.job ? " fit-job-error" : ""}`}
              />
              <FieldFeedback name="job" value={draft.job} error={errors.job} />
              <div className="fit-app-actions">
                <button type="submit" className="fit-app-secondary">
                  Check draft inputs
                </button>
                <button
                  type="button"
                  className="fit-app-text-button"
                  onClick={() => {
                    setDraft(emptyDraft);
                    setErrors({});
                    setPrepared(false);
                  }}
                >
                  Clear drafts
                </button>
              </div>
              <p className="fit-app-help" role="status">
                {prepared
                  ? "Draft inputs are ready for future integration. No analysis has run and nothing has been sent."
                  : "Checking a draft only validates required fields and size limits."}
              </p>
              <div className="fit-app-live-lock">
                <button
                  type="button"
                  className="fit-app-primary"
                  disabled
                  aria-describedby="fit-live-help"
                >
                  <LockKeyhole size={16} aria-hidden="true" /> Analyze my fit ·
                  Not available yet
                </button>
                <p id="fit-live-help">
                  Live analysis is not available yet. Checking your draft does
                  not send it for analysis.
                </p>
              </div>
            </form>
          </section>
          <section
            className="fit-app-panel fit-app-result-panel"
            aria-labelledby="results-title"
          >
            <div className="fit-app-panel-heading">
              <span className="fit-app-step">02</span>
              <div>
                <h2 id="results-title">Explore the evidence</h2>
                <p>
                  {demo
                    ? "Fictional API demo selected"
                    : "Awaiting an analysis"}
                </p>
              </div>
              <Scale size={21} aria-hidden="true" />
            </div>
            <DemoAnalysis key={demo ? "demo" : "prepare"} selected={demo} />
          </section>
        </div>
        <section className="fit-app-walkthrough">
          <div>
            <p className="fit-app-eyebrow">TRY THE DISCOVERY LOOP</p>
            <h2>What could one good question uncover?</h2>
            <p>
              Explore a separate, hand-written interview scenario. No AI runs,
              and your drafts and API results do not transfer into it.
            </p>
          </div>
          <button
            className="fit-app-secondary"
            type="button"
            aria-expanded={walkthrough}
            aria-controls="fit-offline"
            onClick={() => setWalkthrough((v) => !v)}
          >
            {walkthrough ? "Close walkthrough" : "Open offline walkthrough"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
        <div id="fit-offline">{walkthrough && <OfflineExplorer />}</div>
        <footer className="fit-app-footer">
          <span>ScaleMe · Evidence, not assumptions.</span>
          <span>No hiring predictions · No independent verification</span>
        </footer>
      </main>
    </div>
  );
}

function FieldFeedback({
  name,
  value,
  error,
}: {
  name: keyof FitDraft;
  value: string;
  error?: string;
}) {
  return (
    <div className="fit-app-field-feedback">
      <span id={`fit-${name}-error`} className="fit-app-field-error">
        {error}
      </span>
      <span id={`fit-${name}-count`}>
        {value.length.toLocaleString("en-US")} /{" "}
        {draftLimits[name].toLocaleString("en-US")}
      </span>
    </div>
  );
}

function DemoAnalysis({ selected }: { selected: boolean }) {
  const [result, setResult] = useState<FitResult>();
  const [error, setError] = useState<FitClientError>();
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const active = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) heading.current?.focus({ preventScroll: true });
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [selected]);
  useEffect(() => {
    if (!error?.retryAfterSeconds) return;
    const until = Date.now() + error.retryAfterSeconds * 1000;
    const timer = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [error]);

  async function load() {
    if (!selected || active.current || remaining > 0) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setResult(undefined);
    setError(undefined);
    setRemaining(0);
    try {
      const next = await analyzeFit(
        { mode: "demo" },
        { signal: controller.signal },
      );
      if (active.current === controller) setResult(next);
    } catch (cause) {
      if (active.current !== controller) return;
      const next =
        cause instanceof FitClientError
          ? cause
          : new FitClientError(
              "REQUEST_FAILED",
              "The fictional demo could not be loaded.",
            );
      setError(next);
      setRemaining(next.retryAfterSeconds ?? 0);
    } finally {
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
        heading.current?.focus({ preventScroll: true });
      }
    }
  }
  function cancel() {
    active.current?.abort();
    active.current = null;
    setLoading(false);
    setError(
      new FitClientError(
        "CANCELLED",
        "Demo request cancelled. No result was produced.",
        true,
      ),
    );
    heading.current?.focus({ preventScroll: true });
  }
  return (
    <div className="fit-app-demo-content">
      {!selected ? (
        <div className="fit-app-empty fit-app-initial">
          <span className="fit-app-empty-icon">
            <Scale size={30} aria-hidden="true" />
          </span>
          <h3>Your evidence review starts here.</h3>
          <p>
            Prepare a resume and target role on the left. Live analysis is not
            available yet, so no personal result will appear.
          </p>
          <div className="fit-app-demo-invite">
            <FlaskConical size={20} aria-hidden="true" />
            <h4>Want to see how results work?</h4>
            <p>
              Explicitly select a fictional API demo. It returns the same fixed
              sample for everyone and ignores all pasted content.
            </p>
            <Link
              href="/fit-insights?demo=true"
              className="fit-app-secondary"
              scroll={false}
            >
              Select fictional API demo{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="fit-app-demo-toolbar">
            <span className="fit-app-demo-label">
              <FlaskConical size={15} aria-hidden="true" /> FICTIONAL API DEMO
            </span>
            <Link href="/fit-insights" scroll={false}>
              Exit demo
            </Link>
          </div>
          <h3 ref={heading} tabIndex={-1} className="fit-app-result-heading">
            {loading
              ? "Loading fictional sample…"
              : result
                ? "Sample evidence review"
                : error
                  ? "Demo result unavailable"
                  : "A sample, with clear boundaries."}
          </h3>
          <p className="fit-app-help">
            This API demonstration ignores your drafts. No pasted content is
            submitted. It uses a fixed synthetic resume and job scenario,
            separate from the offline interview walkthrough.
          </p>
          <div role="status" aria-live="polite" className="fit-app-status">
            {loading
              ? "Requesting a fixed fictional sample. No live AI is running."
              : result
                ? "Fictional sample loaded. This is not an analysis of your drafts."
                : ""}
          </div>
          {error && (
            <div className="fit-app-error" role="alert">
              <strong>
                {error.code === "CANCELLED"
                  ? "Request cancelled"
                  : "Unable to show a result"}
              </strong>
              <p>{error.message}</p>
              <p>
                Your local drafts have not been sent. No sample has been
                substituted.
              </p>
            </div>
          )}
          <div aria-busy={loading}>
            {result ? (
              <ApiResults result={result} />
            ) : (
              !loading &&
              !error && (
                <div className="fit-app-sample-preview">
                  <h4>What this demo contains</h4>
                  <p>
                    A fictional portal project, a supported application
                    requirement, and an unanswered question about testing. No
                    real job listing or candidate is used.
                  </p>
                </div>
              )
            )}
          </div>
          <div className="fit-app-actions">
            {loading ? (
              <button
                type="button"
                className="fit-app-secondary"
                onClick={cancel}
              >
                Cancel request
              </button>
            ) : (
              <button
                type="button"
                className="fit-app-primary"
                disabled={remaining > 0 || (!!error && !error.retryable)}
                onClick={load}
              >
                {remaining > 0
                  ? `Try again in ${remaining}s`
                  : result
                    ? "Reload fictional sample"
                    : error
                      ? "Try fictional demo again"
                      : "Load fictional sample"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {(result || error) && !loading && (
              <button
                type="button"
                className="fit-app-text-button"
                onClick={() => {
                  setResult(undefined);
                  if (!remaining) setError(undefined);
                  heading.current?.focus({ preventScroll: true });
                }}
              >
                Clear result
              </button>
            )}
          </div>
          {error && !error.retryable && (
            <p className="fit-app-help">
              This error cannot be retried here. Exit the demo and return later.
            </p>
          )}
        </>
      )}
    </div>
  );
}
