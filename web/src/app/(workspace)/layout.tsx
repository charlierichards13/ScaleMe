import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/** Shared sidebar frame for the dashboard and the workspace routes under it. */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
