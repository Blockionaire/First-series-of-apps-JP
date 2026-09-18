/**
 * The STAI marks, from the supplied artwork in public/brand/.
 *
 * ── Why these are CSS masks and not <img> ────────────────────────────────
 * The artwork arrived as flat raster tiles: the S and the S+ on a navy field,
 * the wordmark on a cream one. Dropping those in directly would have put a
 * visible rectangle in the header, because the artwork's navy (#0a2540) is not
 * the site's navy (#0e1726) — and it would have frozen the marks to one theme,
 * so the cream S would vanish on the light theme and the navy wordmark on the
 * dark one.
 *
 * So the ink was extracted to an alpha mask (scripts/extract-brand.py) and is
 * painted here with `currentColor`. The shapes are exactly the supplied ones;
 * the colour follows the theme, which is what the hand-drawn placeholders these
 * replace were doing with `stroke="currentColor"`.
 *
 * STAI+ is two-tone, and a single mask carries one colour, so it is two masks
 * stacked in one box: the S in currentColor, the plus in gold. They are cropped
 * to a shared bounding box so they stay in register at any size.
 */

/** Aspect ratios of the extracted masks — keep in step with public/brand/. */
const RATIO = {
  s: 433 / 322,
  sPlus: 249 / 185,
  wordmark: 171 / 86,
} as const;

type MaskProps = { src: string; ratio: number; height: number; color?: string; className?: string };

/**
 * One masked shape. `currentColor` unless a colour is forced, so the mark
 * inherits whatever ink its container already uses.
 *
 * -webkit-mask-image is still required for Safari; without it the element
 * renders as a solid block of currentColor, which is a very loud failure.
 */
function Mask({ src, ratio, height, color = "currentColor", className }: MaskProps) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        // Rounded: the raw ratio puts 15 decimal places of width into the DOM.
        width: Math.round(height * ratio * 100) / 100,
        height,
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

/** The S mark. Cream on the dark theme, navy on the light one. */
export function SMark({ size = 28 }: { size?: number }) {
  return <Mask src="/brand/s-mark.png" ratio={RATIO.s} height={size} className="text-cream-100" />;
}

/** The S+ mark. The only logo variant allowed to carry gold. */
export function SPlusMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="relative inline-block text-cream-100"
      style={{ width: size * RATIO.sPlus, height: size }}
      aria-hidden="true"
    >
      <Mask src="/brand/s-plus-s.png" ratio={RATIO.sPlus} height={size} />
      <span className="absolute inset-0">
        <Mask src="/brand/s-plus-gold.png" ratio={RATIO.sPlus} height={size} color="#C9A84C" />
      </span>
    </span>
  );
}

/**
 * The "STAI." wordmark.
 *
 * Carries the accessible name, because it replaces text: the header used to
 * render the letters in the display face, and swapping that for a mask would
 * otherwise leave a link with no name for a screen reader.
 */
export function Wordmark({ height = 24, className }: { height?: number; className?: string }) {
  return (
    <span className={className} role="img" aria-label="STAI">
      <Mask src="/brand/wordmark.png" ratio={RATIO.wordmark} height={height} />
    </span>
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
