import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** Joins class names, skipping falsy values. */
export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export const buttonStyles = {
  primary: cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-strong",
    focusRing,
  ),
  secondary: cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-strong",
    focusRing,
  ),
  ghost: cx(
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-strong transition-colors hover:bg-brand-soft",
    focusRing,
  ),
  icon: cx(
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-brand-soft hover:text-brand-strong",
    focusRing,
  ),
  focusRing,
};

type CardProps = ComponentPropsWithoutRef<"section"> & { padded?: boolean };

export function Card({ className, padded = true, ...props }: CardProps) {
  return (
    <section
      className={cx("min-w-0 rounded-2xl border border-line bg-surface shadow-card", padded && "p-5 sm:p-6", className)}
      {...props}
    />
  );
}

export function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-40">
        <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "info" | "demo";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-soft text-brand-strong",
  success: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
  info: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200",
  demo: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-4",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Standard "this is not real data" label. */
export function DemoBadge({ label = "Demo · fictional" }: { label?: string }) {
  return <Badge tone="demo">{label}</Badge>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-canvas/60 px-4 py-7 text-center sm:px-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden="true">
        {icon}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
