import type { Resume } from "@/lib/ai/schemas";
import { uploadResume, validateResumeFile } from "./client";

export type UploadState = {
  file: File | null;
  phase: "idle" | "checking" | "ready" | "processing" | "success" | "error" | "cancelled";
  message: string;
};

/** One explicit upload operation. Generation checks reject late validation/transport results. */
export function createUploadTask(
  publish: (resume: Resume | null) => void,
  upload = uploadResume,
) {
  let state: UploadState = { file: null, phase: "idle", message: "" };
  let version = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const update = (next: UploadState) => { state = next; listeners.forEach((fn) => fn()); };
  const stop = () => { version++; controller?.abort(); controller = null; clearTimeout(timer); };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async select(file: File) {
      stop(); publish(null);
      const current = version;
      update({ file: null, phase: "checking", message: "Checking PDF…" });
      try {
        await validateResumeFile(file);
        if (current !== version) return false;
        update({ file, phase: "ready", message: "PDF selected. Nothing has been uploaded." });
        return true;
      } catch {
        if (current === version) update({ file: null, phase: "error", message: "Choose a nonempty text-based PDF no larger than 5 MiB." });
        return false;
      }
    },
    async extract(token: string) {
      if (!state.file || state.phase === "processing") return;
      if (!token.trim()) { update({ ...state, phase: "error", message: "Ask the project owner for a private preview access code. It is not an account password." }); return; }
      stop(); publish(null);
      const current = version;
      const signal = (controller = new AbortController()).signal;
      update({ ...state, phase: "processing", message: "Extracting your resume. This may take a few moments…" });
      timer = setTimeout(() => {
        stop();
        update({ ...state, phase: "error", message: "The upload took too long. Try a simpler PDF." });
      }, 30_000);
      try {
        const resume = await upload(state.file!, token, signal);
        if (current !== version || signal.aborted) return;
        publish(resume);
        update({ file: null, phase: "success", message: "Resume extracted. Review the text before continuing." });
      } catch (error) {
        if (current === version) update({ ...state, phase: "error", message: error instanceof Error && error.name === "Error" ? error.message : "The PDF could not be processed. Try again." });
      } finally {
        if (current === version) { clearTimeout(timer); controller = null; }
      }
    },
    cancel() { stop(); update({ ...state, phase: "cancelled", message: "Upload cancelled. No new resume was kept." }); },
    clear() { stop(); publish(null); update({ file: null, phase: "idle", message: "Resume cleared from this tab." }); },
    dispose() { stop(); },
  };
}
