import { buttonStyles, cx } from "@/components/ui/primitives";

/** Shared layout and button classes for the public welcome page. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-8";

export const eyebrow = "text-xs font-semibold uppercase tracking-[0.18em] text-brand";

export const cta = {
  primary: cx(
    "group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-semibold text-white",
    "shadow-[0_1px_2px_rgb(32_38_56/0.08),0_10px_24px_-12px_rgb(88_86_214/0.7)]",
    "transition-[background-color,box-shadow,transform] duration-200 hover:bg-brand-strong active:translate-y-px",
    buttonStyles.focusRing,
  ),
  secondary: cx(
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 text-[15px] font-semibold text-ink",
    "transition-[border-color,background-color,transform] duration-200 hover:border-slate-300 hover:bg-white active:translate-y-px",
    buttonStyles.focusRing,
  ),
};

export const navLink = cx(
  "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-ink",
  buttonStyles.focusRing,
);
