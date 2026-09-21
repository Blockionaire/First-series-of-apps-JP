/**
 * The share-card dimensions, on their own, with no dependencies.
 *
 * Separate from lib/og.tsx because that module imports `next/og`, which pulls
 * a font renderer and a WASM rasteriser in with it. Two numbers are not worth
 * that: the article page needs them for its structured data, and importing
 * them from og.tsx would have put the whole image pipeline into a route that
 * renders no images.
 *
 * 1200×630 is the size every social platform and Google's article structured
 * data expect, so it is stated once and read everywhere.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
