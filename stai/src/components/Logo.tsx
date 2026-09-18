import { S_MARK, S_PLUS_INK, S_PLUS_GOLD, WORDMARK, type BrandPath } from "./brand-paths";

/**
 * The STAI marks, from the supplied brand artwork.
 *
 * The artwork arrived as raster tiles with baked-in backgrounds — the S and the
 * S+ on navy, the wordmark on cream. Used as supplied each would have put a
 * visible rectangle on the page, because the artwork's navy (#0a2540) is not
 * the site's (#0e1726), and each would have been locked to one theme: the cream
 * S invisible on the light theme, the navy wordmark on the dark one.
 *
 * So scripts/extract-brand.py lifts the ink off its background and traces it to
 * outlines, which are drawn here in `currentColor`. The shapes are exactly the
 * supplied ones; only the colour follows the theme.
 *
 * ── Why inline SVG and not a CSS mask ────────────────────────────────────
 * The first version of this used `mask-image: url(/brand/s-mark.png)`. It is a
 * neat trick and it has one intolerable failure mode: when the image does not
 * load — a 404, a slow deploy, an asset that never uploaded — the mask is empty
 * and the element renders as *nothing*. The logo does not degrade, it silently
 * disappears, and the header looks broken with no error anywhere to explain it.
 *
 * An inline path cannot fail that way. It is part of the document, it needs no
 * second request, and it stays crisp at any size on any display.
 */

function Glyph({ path, height, color, title }: { path: BrandPath; height: number; color?: string; title?: string }) {
  return (
    <svg
      height={height}
      width={(height * path.w) / path.h}
      viewBox={`0 0 ${path.w} ${path.h}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* evenodd: the S has a counter and the wordmark has bowls. Without it
          the holes fill in and the marks turn into solid blobs. */}
      <path d={path.d} fill={color ?? "currentColor"} fillRule="evenodd" />
    </svg>
  );
}

/** The S mark. Cream on the dark theme, navy on the light one. */
export function SMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-block text-cream-100">
      <Glyph path={S_MARK} height={size} />
    </span>
  );
}

/**
 * The S+ mark — the only logo variant allowed to carry gold.
 *
 * Two paths in one viewBox rather than two stacked elements: they were traced
 * from a single shared bounding box, so drawing them in the same coordinate
 * space keeps the plus in register with the S at every size, for free.
 */
export function SPlusMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-block text-cream-100">
      <svg
        height={size}
        width={(size * S_PLUS_INK.w) / S_PLUS_INK.h}
        viewBox={`0 0 ${S_PLUS_INK.w} ${S_PLUS_INK.h}`}
        aria-hidden="true"
        focusable="false"
      >
        <path d={S_PLUS_INK.d} fill="currentColor" fillRule="evenodd" />
        <path d={S_PLUS_GOLD.d} fill="#C9A84C" fillRule="evenodd" />
      </svg>
    </span>
  );
}

/**
 * The "STAI." wordmark.
 *
 * Carries an accessible name because it replaces text: the header used to set
 * the letters in the display face, and swapping that for a drawing would
 * otherwise leave the home link with nothing for a screen reader to announce.
 */
export function Wordmark({ height = 24, className }: { height?: number; className?: string }) {
  return (
    <span className={className ?? "inline-block text-cream-100"}>
      <Glyph path={WORDMARK} height={height} title="STAI" />
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
