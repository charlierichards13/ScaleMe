"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { buttonStyles } from "@/components/ui/primitives";
import { SidebarContent } from "./Sidebar";
import { Logo } from "./Logo";

/**
 * Persistent workspace frame: fixed sidebar on large screens, slide-in drawer
 * with Escape-to-close and focus return on smaller screens.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    menuButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-brand shadow-card focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-900/30"
          />
          <div
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl"
          >
            <button type="button" onClick={close} aria-label="Close navigation" className={`${buttonStyles.icon} absolute right-3 top-5`}>
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-72">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className={buttonStyles.icon}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <Logo compact />
        </div>
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
