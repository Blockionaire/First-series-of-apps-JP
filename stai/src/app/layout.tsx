import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Header from "@/components/chrome/Header";
import Footer from "@/components/chrome/Footer";
import JsonLd from "@/components/JsonLd";
import Analytics from "@/components/Analytics";
import { SITE, abs, organizationSchema, websiteSchema, verificationMeta } from "@/lib/seo";
import { THEME_COOKIE, themeFromCookie } from "@/lib/theme-choice";

/**
 * Site-wide defaults only.
 *
 * Deliberately NO `alternates.canonical` here. Next merges layout metadata
 * into every route below it, so a canonical set at the root is inherited by
 * any page that does not set its own — which meant a new route could ship
 * telling crawlers it was a duplicate of the homepage, silently, with nothing
 * failing. Each page declares its own canonical through `pageMeta`, and
 * tests/seo.test.mjs fails the build if a public page forgets to. A page with
 * no canonical is merely self-canonical, which is the safe default; a page
 * canonicalised to the wrong URL is de-indexed.
 *
 * A function rather than a constant because the verification tokens come from
 * the environment, and on Workers `process.env` is populated per request, not
 * at module load. A constant would read it too early and silently emit no
 * tag — the exact failure that makes a Search Console verification look
 * broken for reasons nothing reports.
 */
export function generateMetadata(): Metadata {
  const verification = verificationMeta();
  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: `STAI — ${SITE.tagline}`,
      template: "%s — STAI",
    },
    description: SITE.description,
    applicationName: SITE.name,
    keywords: [
      "AI in audit",
      "EU AI Act audit",
      "audit AI prompts",
      "CSRD assurance AI",
      "ISQM 1 AI governance",
      "audit technology Europe",
    ],
    alternates: {
      types: { "application/rss+xml": [{ url: abs("/feed.xml"), title: "STAI — The Briefing" }] },
    },
    ...(verification ? { verification } : {}),
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      type: "website",
      url: SITE.url,
      siteName: SITE.name,
      locale: SITE.locale,
      title: `STAI — ${SITE.tagline}`,
      description: SITE.description,
    },
    twitter: { card: "summary_large_image", site: SITE.twitter, creator: SITE.twitter },
    category: "Business",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0D1320" },
    { media: "(prefers-color-scheme: light)", color: "#F6F1E8" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Theme is server-rendered from the cookie — no flash of wrong theme. With
  // no choice made, no attribute is rendered and the Paper Edition applies
  // (lib/theme-choice.ts).
  const theme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en-GB" data-theme={theme}>
      <head>
        {/* The display face is the first impression; preload so it never
            flashes a fallback. Latin subset only — latin-ext loads on demand. */}
        <link
          rel="preload"
          href="/fonts/eb-garamond-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/archivo-latin-wdth-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/jetbrains-mono-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
