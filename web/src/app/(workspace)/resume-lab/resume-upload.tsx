"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setActiveResume, useActiveResume } from "@/lib/resume/active-resume";
import { uploadResume } from "@/lib/resume/client";

const button = "rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50";

export default function ResumeUpload() {
  const resume = useActiveResume();
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => operation.current?.abort(), []);

  async function parse(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true); setError("");
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const parsed = await uploadResume(file, token, controller.signal);
      if (!controller.signal.aborted) {
        setActiveResume(parsed); setFile(null); setToken("");
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error && error.name === "Error" ? error.message : "The upload could not be completed.");
      else setError("The upload was cancelled or timed out.");
    } finally { clearTimeout(timer); setBusy(false); operation.current = null; }
  }

  return (
    <section className="mx-auto mb-6 max-w-4xl space-y-5 rounded-2xl border border-line bg-surface p-6" aria-labelledby="resume-upload-title">
      <h1 id="resume-upload-title" className="text-2xl font-bold">Resume Lab — PDF upload</h1>
      <p>Private preview · synthetic resumes only until security review. Choose a text-based PDF, up to 5 MiB and 20 pages. Scans are not supported.</p>
      <p className="text-sm text-muted">The PDF is processed in server memory and is not saved. Extracted text stays in this tab until you clear it or reload. Uploading does not contact AI services.</p>
      <p className="text-sm text-muted">Resume rewriting and contextual interviews remain separate work. <Link className="underline" href="/impact-lab">Open the fictional sample resume story</Link> or <Link className="underline" href="/dashboard">return to the dashboard</Link>.</p>
      <form onSubmit={parse} className="grid gap-4">
        <label className="grid gap-1">PDF resume
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); }} />
        </label>
        <label className="grid gap-1">Private upload access code
          <input className="rounded border border-line p-2" type="password" autoComplete="off" value={token} disabled={busy} onChange={(event) => setToken(event.target.value)} required maxLength={4096} />
        </label>
        <div className="flex flex-wrap gap-3">
          <button className={button} disabled={!file || !token || busy}>{busy ? "Extracting PDF…" : "Extract resume"}</button>
          {busy && <button type="button" className={button} onClick={() => operation.current?.abort()}>Cancel upload</button>}
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      {resume && <div className="space-y-4" aria-live="polite">
        <p role="status">Extracted {resume.filename ?? "resume"} · {resume.text.length.toLocaleString()} characters · {resume.sections?.length ?? 0} detected sections</p>
        <div className="flex flex-wrap gap-4">
          <Link className={button} href="/fit-insights">Use this resume in Fit Explorer</Link>
          <button className="underline" onClick={() => { operation.current?.abort(); setActiveResume(null); setError(""); }}>Clear extracted resume</button>
        </div>
        <details><summary>Review extracted text</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm">{resume.text}</pre></details>
        <details><summary>Existing Resume JSON</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm">{JSON.stringify({ resume }, null, 2)}</pre></details>
        <p className="text-sm text-muted">Review the text before using it. Layout and section detection are best-effort; no experience or skills were invented.</p>
      </div>}
    </section>
  );
}
