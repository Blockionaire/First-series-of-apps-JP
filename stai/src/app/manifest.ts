import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * The web app manifest.
 *
 * There wasn't one. On a laptop that goes unnoticed — the browser reads
 * <link rel="icon"> and shows the S. On Android it is the manifest that
 * supplies the home-screen and task-switcher icon, and with none present
 * Chrome falls back to whatever it can scrape or generates a letter tile.
 * That is the most likely reason a phone shows something other than the mark
 * the laptop shows.
 *
 * ── Icons ────────────────────────────────────────────────────────────────
 * Both entries point at the existing metadata routes rather than at copies in
 * public/. One set of files stays the source of truth for the favicon, the
 * touch icon and this, so a future brand change cannot update two of the
 * three and leave the phone on the old mark — which is exactly the failure
 * being reported.
 *
 * /icon.png is declared `maskable` as well as `any`. Android crops an
 * adaptive icon to a circle or squircle and only the central 80% is
 * guaranteed to survive; measured, the S occupies the central 64% of the
 * 512px square and is centred to the pixel, so it clears that safe zone.
 * Without the declaration Chrome assumes the worst and pads the icon onto a
 * white plate, which on a navy mark looks like a mistake.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `STAI — ${SITE.tagline}`,
    short_name: "STAI",
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    // Matches the dark theme-color in layout.tsx: the splash should not flash
    // a colour the site never uses.
    background_color: "#0E1726",
    theme_color: "#0E1726",
    lang: "en-GB",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
