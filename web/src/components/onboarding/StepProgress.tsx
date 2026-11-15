import { cx } from "@/components/ui/primitives";

/** "Step 2 of 4" with a segmented bar. The text is the accessible source of truth. */
export function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
        <p className="text-brand">
          Step {current} of {total}
        </p>
        <p className="text-muted">{label}</p>
      </div>
      <div aria-hidden="true" className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className="h-1.5 overflow-hidden rounded-full bg-line">
            <span
              className={cx(
                "block h-full rounded-full bg-brand transition-transform duration-500 ease-out motion-reduce:transition-none",
                index < current ? "translate-x-0" : "-translate-x-full",
              )}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
