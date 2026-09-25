"use client";

/**
 * Client-side theme helpers for the hand-drawn canvases.
 * Everything DOM-based reads CSS tokens automatically; the canvases paint
 * raw rgba, so they ask these helpers each frame (a dataset read — cheap).
 *
 * The Paper Edition is the default: only an explicit data-theme="dark" (the
 * reader's choice, see lib/theme-choice.ts) is the Night Edition.
 */

export function isLightTheme(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.theme !== "dark";
}

/** Ink for canvas drawing: brown-black on paper, warm ivory at night. */
export function canvasInk(alpha: number): string {
  return isLightTheme() ? `rgba(29,25,21,${alpha})` : `rgba(243,238,231,${alpha})`;
}

/** Panel fill for canvas tooltips. */
export function canvasPanel(alpha: number): string {
  return isLightTheme() ? `rgba(246,241,232,${alpha})` : `rgba(13,19,32,${alpha})`;
}

/** Re-run `cb` whenever the theme attribute flips (returns a disposer). */
export function onThemeChange(cb: () => void): () => void {
  const mo = new MutationObserver((muts) => {
    if (muts.some((m) => m.attributeName === "data-theme")) cb();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
