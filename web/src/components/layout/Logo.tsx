export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-white shadow-card"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 15 L9 10 L12 13 L16 6" />
          <path d="M12.5 6 H16 V9.5" />
        </svg>
      </span>
      {!compact && <span className="text-lg font-bold tracking-tight text-ink">ScaleMe</span>}
    </span>
  );
}
