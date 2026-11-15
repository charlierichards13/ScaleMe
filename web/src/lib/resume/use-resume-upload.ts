"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { setActiveResume } from "./active-resume";
import { createUploadTask } from "./upload-task";

export function useResumeUpload() {
  const [task] = useState(() => createUploadTask(setActiveResume));
  const state = useSyncExternalStore(task.subscribe, task.getSnapshot, task.getSnapshot);
  useEffect(() => () => task.dispose(), [task]);
  return { ...state, select: task.select, extract: task.extract, cancel: task.cancel, clear: task.clear };
}

export type ResumeUploadTask = ReturnType<typeof useResumeUpload>;
