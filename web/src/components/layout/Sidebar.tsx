"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { buttonStyles, cx } from "@/components/ui/primitives";
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
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            buttonStyles.focusRing,
            active ? "bg-brand-soft text-brand-strong" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
          )}
        >
          <Icon
            aria-hidden="true"
            className={cx("h-[18px] w-[18px] shrink-0", active ? "text-brand" : "text-slate-400 group-hover:text-slate-600")}
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.status && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {item.status}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Link href="/" onClick={onNavigate} className={cx("inline-flex rounded-lg", buttonStyles.focusRing)} aria-label="ScaleMe dashboard">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
        <ul className="space-y-1">{primaryNav.map(renderItem)}</ul>
        <p className="px-3 pb-2 pt-7 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Account</p>
        <ul className="space-y-1">{secondaryNav.map(renderItem)}</ul>
      </nav>

      <div className="m-3 rounded-xl border border-line bg-canvas p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand" />
          Guest session
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">
          No account yet, so nothing you enter is saved after you close this tab.
        </p>
      </div>
    </div>
  );
}
