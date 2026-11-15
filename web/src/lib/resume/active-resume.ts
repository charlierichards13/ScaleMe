"use client";

import { useSyncExternalStore } from "react";
import { createResumeSession } from "./session";

const session = createResumeSession();
export const setActiveResume = session.set;
// SSR always renders the empty state; applicant data exists only in this browser's module.
export function useActiveResume() {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, () => null);
}
