/**
 * Client-side checks for the optional resume picker in onboarding.
 *
 * These checks are UX only. They are NOT a security control: the file never
 * leaves the browser, and any future upload must repeat every check on the
 * server (type, size, magic bytes, parser time/page limits). See Issue #4.
 */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** First bytes of every PDF file: "%PDF-". */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

export type ResumeCheck =
  | { ok: true }
  | { ok: false; reason: "empty" | "too-large" | "not-pdf" };

/** Checks the name and size the browser reports. Call before reading any bytes. */
export function checkResumeMetadata(file: { name: string; size: number; type: string }): ResumeCheck {
  if (file.size <= 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_RESUME_BYTES) return { ok: false, reason: "too-large" };
  const looksLikePdf = file.name.toLowerCase().endsWith(".pdf") && (file.type === "" || file.type === "application/pdf");
  return looksLikePdf ? { ok: true } : { ok: false, reason: "not-pdf" };
}

/** True when the leading bytes match the PDF signature (the extension alone proves nothing). */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_SIGNATURE.length && PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export const resumeCheckMessages: Record<Exclude<ResumeCheck, { ok: true }>["reason"], string> = {
  empty: "That file is empty. Choose a different PDF.",
  "too-large": "That file is larger than 5 MB. Choose a smaller PDF.",
  "not-pdf": "That doesn't look like a PDF. Choose a .pdf file.",
};

/** Human-readable size, e.g. "1.2 MB" or "380 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
