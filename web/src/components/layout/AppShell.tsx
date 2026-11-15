"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { buttonStyles } from "@/components/ui/primitives";
import { SidebarContent } from "./Sidebar";
import { Logo } from "./Logo";

/** Native modal dialog provides focus containment and makes the background inert. */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const dialog = drawer.current;
    if (!dialog) return;
    const trigger = menuButton.current;
    const desktop = window.matchMedia("(min-width: 1024px)");
    // A resize must not leave an invisible modal blocking the desktop shell.
    const onResize = () => { if (desktop.matches) close(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeButton.current?.focus();
    desktop.addEventListener("change", onResize);
    onResize();
    return () => {
      desktop.removeEventListener("change", onResize);
      dialog.close();
      document.body.style.overflow = overflow;
      if (!desktop.matches) trigger?.focus();
    };
  }, [open, close]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-brand-strong shadow-card focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>
      <dialog
        ref={drawer}
        id="workspace-navigation"
        aria-label="Workspace navigation"
        aria-modal="true"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <div className="relative h-full w-80 max-w-[88vw] bg-surface shadow-xl">
          <button ref={closeButton} type="button" onClick={close} aria-label="Close navigation" className={`${buttonStyles.icon} absolute right-3 top-4`}>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <SidebarContent onNavigate={close} />
        </div>
      </dialog>
      <div className="lg:pl-72">
        <div className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
          <button ref={menuButton} type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="workspace-navigation" className={buttonStyles.icon}>
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <Logo compact />
          <span className="ml-auto text-xs font-medium text-muted">Guest workspace</span>
        </div>
        <main id="main" tabIndex={-1} className="outline-none">{children}</main>
      </div>
    </div>
  );
}
