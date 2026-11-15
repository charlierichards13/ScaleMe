import { ResumeSchema, type Resume } from "@/lib/ai/schemas";

/** A tab-memory adapter. No browser storage, cookies, server singleton state or persistence. */
export function createResumeSession() {
  let resume: Resume | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => resume,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(value: Resume | null) {
      resume = value === null ? null : ResumeSchema.parse(value);
      listeners.forEach((listener) => listener());
    },
  };
}
