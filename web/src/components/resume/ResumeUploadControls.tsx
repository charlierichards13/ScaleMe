"use client";

import { useId, useRef, useState } from "react";
import { FileText, LoaderCircle, Upload, X } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { formatFileSize } from "@/lib/onboarding/resume-file";
import type { ResumeUploadTask } from "@/lib/resume/use-resume-upload";

export function ResumeUploadControls({ upload }: { upload: ResumeUploadTask }) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const busy = upload.phase === "processing" || upload.phase === "checking";
  const select = (file?: File) => { if (file && !busy) void upload.select(file); };
  async function extract() { await upload.extract(); }

  return <div className="space-y-5">
    <div onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files[0]); }}
      className={cx("rounded-2xl border-2 border-dashed p-6 text-center sm:p-8", dragging ? "border-brand bg-brand-soft" : "border-line bg-canvas/60")}>
      <Upload aria-hidden="true" className="mx-auto h-7 w-7 text-brand" />
      <p className="mt-3 font-semibold text-ink">{upload.file ? "Your PDF is ready" : "Start with your experience"}</p>
      <p id={`${id}-limits`} className="mt-2 text-sm leading-6 text-muted">Drop a synthetic PDF here or choose a file.<br />Text-based PDF · up to 5 MiB · 20 pages · no scans</p>
      <label className={cx(buttonStyles.secondary, "relative mt-4 min-h-11 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand", busy && "opacity-50")}>
        {upload.file ? "Replace PDF" : "Choose PDF"}
        <input ref={picker} aria-label="PDF resume" aria-describedby={`${id}-limits`} type="file" accept=".pdf,application/pdf" disabled={busy}
          className="sr-only" onChange={(event) => { select(event.target.files?.[0]); event.target.value = ""; }} />
      </label>
      <p className="mt-3 text-xs leading-5 text-muted">Selecting a file does not upload it.</p>
    </div>
    {upload.file && <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-4">
      <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
      <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{upload.file.name}</p><p className="text-xs text-muted">{formatFileSize(upload.file.size)}</p></div>
      <button type="button" aria-label="Remove selected PDF" className={cx(buttonStyles.icon, "min-h-11 min-w-11")} onClick={() => { upload.clear(); picker.current?.focus(); }}><X aria-hidden="true" className="h-4 w-4" /></button>
    </div>}
    <div className="rounded-xl border border-line bg-canvas/50 p-4 text-sm leading-6 text-muted">
      <p className="font-semibold text-ink">PDF extraction demo</p>
      <p className="mt-2">Select a text-based PDF, then choose Extract resume. No access code is needed during the demo window. Please avoid sensitive personal information while this preview is being tested.</p>
      <p className="mt-2">We do not permanently store your PDF. Extracted text stays in this browser tab until cleared or reloaded; extraction does not call AI.</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!upload.file || busy} onClick={() => void extract()} className={cx(buttonStyles.primary, "min-h-11 disabled:cursor-not-allowed disabled:opacity-50")}>
        {upload.phase === "processing" && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{upload.phase === "processing" ? "Extracting resume…" : "Extract resume"}
      </button>
      {busy && <button type="button" onClick={upload.cancel} className={cx(buttonStyles.secondary, "min-h-11")}>Cancel upload</button>}
    </div>
    <div aria-busy={busy}>
      {upload.phase === "error" ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">{upload.message}</p>
        : <p role="status" aria-live="polite" className="text-sm leading-6 text-muted">{upload.message}</p>}
    </div>
  </div>;
}
