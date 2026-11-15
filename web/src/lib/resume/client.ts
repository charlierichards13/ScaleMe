import { ResumeSchema, type Resume } from "@/lib/ai/schemas";

export async function validateResumeFile(file: File): Promise<void> {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error("Choose a nonempty PDF no larger than 5 MiB.");
  if (!/^%PDF-\d\.\d/.test(await file.slice(0, 8).text())) throw new Error("Choose a text-based PDF.");
}

export async function uploadResume(file: File, token: string, signal: AbortSignal): Promise<Resume> {
  await validateResumeFile(file);
  if (signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/resume/parse", {
    method: "POST", body, signal, credentials: "omit", cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    // Fixed local messages: do not render arbitrary server/proxy/document error text.
    const messages: Record<number, string> = {
      401: "The private upload access code was not accepted.",
      403: "Uploads are not enabled for this site origin.",
      408: "The upload was interrupted or took too long.",
      413: "The PDF exceeds the size, page or text limit. Nothing was truncated.",
      415: "Choose one nonempty text-based PDF.",
      422: "This PDF is unreadable, password-protected, scanned or unsupported.",
      429: "Private upload capacity is busy. Try again later.",
      503: "Private uploads are disabled or the parser is unavailable.",
      504: "The parser took too long. Try a simpler PDF.",
    };
    throw new Error(messages[response.status] ?? "The PDF could not be processed.");
  }
  return ResumeSchema.parse((await response.json()).resume);
}
