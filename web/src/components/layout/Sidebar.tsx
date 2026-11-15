"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
import { routes } from "@/lib/routes";
import { isActive, primaryNav, secondaryNav, type NavItem } from "./nav-items";
import { Logo } from "./Logo";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cx(
            "group flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            buttonStyles.focusRing,
            active ? "bg-brand-soft text-brand-strong" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
          )}
        >
          <Icon
            aria-hidden="true"
            className={cx("h-[18px] w-[18px] shrink-0", active ? "text-brand" : "text-slate-400 group-hover:text-slate-600")}
          />
          <span className="min-w-0 flex-1 leading-5">{item.label}</span>
          {item.status && (
            <span className="shrink-0 rounded-md bg-canvas px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {item.status}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pr-16 pt-6">
        <Link href={routes.dashboard} onClick={onNavigate} className={cx("inline-flex rounded-lg", buttonStyles.focusRing)} aria-label="ScaleMe dashboard">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
        <ul className="space-y-1">{primaryNav.map(renderItem)}</ul>
        <p className="px-3 pb-2 pt-7 text-[11px] font-semibold uppercase tracking-widest text-muted">Account</p>
        <ul className="space-y-1">{secondaryNav.map(renderItem)}</ul>
      </nav>

      <div className="m-3 rounded-xl border border-line bg-canvas p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand" />
          Guest session
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">
          No account yet. What you enter stays on that page until you leave or refresh, and it is not uploaded.
        </p>
      </div>
    </div>
  );
}
