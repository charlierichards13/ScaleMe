import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cx } from "@/components/ui/primitives";

/**
 * Large selectable card backed by a native checkbox or radio, so keyboard,
 * screen-reader and form semantics come from the browser. The input is
 * visually hidden but stays focusable; the card shows the focus ring.
 */
export function ChoiceCard({
  type,
  name,
  checked,
  onChange,
  children,
  icon,
  size = "lg",
}: {
  type: "checkbox" | "radio";
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  icon?: ReactNode;
  size?: "lg" | "sm";
}) {
  return (
    <label
      className={cx(
        "relative flex cursor-pointer select-none items-center gap-3 rounded-2xl border bg-surface transition-[border-color,background-color,box-shadow] duration-200",
        "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand has-[input:focus-visible]:ring-offset-2",
        size === "lg" ? "min-h-16 px-4 py-4" : "min-h-12 px-4 py-2.5",
        checked
          ? "border-brand bg-brand-soft/60 shadow-[0_0_0_1px_var(--brand)]"
          : "border-line hover:border-slate-300 hover:bg-canvas",
      )}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {icon && (
        <span
          aria-hidden="true"
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            checked ? "bg-brand text-white" : "bg-brand-soft text-brand",
          )}
        >
          {icon}
        </span>
      )}
      <span className={cx("min-w-0 flex-1 font-medium text-ink", size === "lg" ? "text-[15px]" : "text-sm")}>{children}</span>
      <span
        aria-hidden="true"
        className={cx(
          "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
          type === "radio" ? "rounded-full" : "rounded-md",
          checked ? "border-brand bg-brand text-white" : "border-slate-300 bg-surface text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </label>
  );
}
