// Cloud Code Studio brand mark — same terminal-prompt tile as the favicon,
// inlined so it renders crisply at any size and inherits currentColor for the
// prompt glyph when `mono` is set.

type Props = {
  size?: number;
  className?: string;
  /** Render the glyph in a single currentColor instead of the emerald brand color. */
  mono?: boolean;
  onClick?: () => void;
};

export function BrandMark({ size = 40, className, mono = false, onClick }: Props) {
  const glyph = mono ? "currentColor" : "#34D399";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      onClick={onClick}
    >
      <defs>
        <linearGradient id="ccs-brand-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C2431" />
          <stop offset="1" stopColor="#0D1117" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#ccs-brand-bg)" />
      <g fill="#FFFFFF" opacity="0.06">
        <circle cx="22" cy="21" r="8" />
        <circle cx="34" cy="17" r="10" />
        <circle cx="45" cy="23" r="7" />
        <rect x="22" y="21" width="23" height="10" rx="5" />
      </g>
      <path
        d="M15 22l12 10-12 10"
        fill="none"
        stroke={glyph}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35 44h14"
        fill="none"
        stroke={glyph}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
