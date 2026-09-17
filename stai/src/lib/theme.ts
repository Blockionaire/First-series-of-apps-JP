"use client";

/**
 * Client-side theme helpers for the hand-drawn canvases.
 * Everything DOM-based reads CSS tokens automatically; the canvases paint
 * raw rgba, so they ask these helpers each frame (a dataset read — cheap).
 */

export function isLightTheme(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
}

/** Ink for canvas drawing: cream on dark, navy on light. */
export function canvasInk(alpha: number): string {
  return isLightTheme() ? `rgba(14,23,38,${alpha})` : `rgba(237,234,227,${alpha})`;
}

/** Panel fill for canvas tooltips. */
export function canvasPanel(alpha: number): string {
  return isLightTheme() ? `rgba(245,242,236,${alpha})` : `rgba(10,17,29,${alpha})`;
}

/** Re-run `cb` whenever the theme attribute flips (returns a disposer). */
export function onThemeChange(cb: () => void): () => void {
  const mo = new MutationObserver((muts) => {
    if (muts.some((m) => m.attributeName === "data-theme")) cb();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
