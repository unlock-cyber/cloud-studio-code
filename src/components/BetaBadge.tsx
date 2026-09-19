// Small "BETA" pill shown superscript-style next to product branding.
// Kept intentionally subtle so the product name remains the primary text.

export function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Beta"
      className={
        "pointer-events-none inline-block select-none rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[9px] font-semibold uppercase leading-[1.4] tracking-wider text-emerald-600 dark:text-emerald-400 " +
        className
      }
    >
      Beta
    </span>
  );
}
