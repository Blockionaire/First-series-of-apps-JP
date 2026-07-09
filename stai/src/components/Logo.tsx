/**
 * Placeholder marks until the supplied SVGs arrive.
 * The S mark: condensed serifless S cut into a framed plate — terminal nameplate.
 * SPlusMark is the ONLY logo variant allowed to carry gold.
 */
export function SMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="#EDEAE3" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M22.5 9.5c-1.2-1.6-3.2-2.5-5.9-2.5-3.6 0-6.1 1.7-6.1 4.5 0 5.9 12.4 3.1 12.4 9 0 2.9-2.6 4.5-6.4 4.5-2.9 0-5.2-1-6.5-2.8"
        fill="none"
        stroke="#EDEAE3"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function SPlusMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="#C9A84C" strokeWidth="1.5" />
      <path
        d="M22.5 9.5c-1.2-1.6-3.2-2.5-5.9-2.5-3.6 0-6.1 1.7-6.1 4.5 0 5.9 12.4 3.1 12.4 9 0 2.9-2.6 4.5-6.4 4.5-2.9 0-5.2-1-6.5-2.8"
        fill="none"
        stroke="#C9A84C"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      <path d="M35 12v10M30 17h10" stroke="#C9A84C" strokeWidth="2.4" strokeLinecap="square" />
    </svg>
  );
}

/** Inline gold plus badge — the premium marker used across the site. */
export function PlusBadge({ label = "STAI+" }: { label?: string }) {
  return (
    <span
      className="f-mono inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-[0.12em] text-gold-300"
      style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.07)" }}
    >
      {label}
    </span>
  );
}
