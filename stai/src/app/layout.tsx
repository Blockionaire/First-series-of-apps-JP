import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Header from "@/components/chrome/Header";
import Footer from "@/components/chrome/Footer";
import JsonLd from "@/components/JsonLd";
import { SITE, abs, organizationSchema, websiteSchema } from "@/lib/seo";

export const metadata: Metadata = {
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
    canonical: SITE.url,
    types: { "application/rss+xml": [{ url: abs("/feed.xml"), title: "STAI — The Briefing" }] },
  },
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E1726" },
    { media: "(prefers-color-scheme: light)", color: "#F5F2EC" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Theme is server-rendered from the cookie — no flash of wrong theme.
  const theme = (await cookies()).get("stai_theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en-GB" data-theme={theme}>
      <head>
        {/* The display face is the first impression; preload so it never
            flashes a fallback. Latin subset only — latin-ext loads on demand. */}
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
      </body>
    </html>
  );
}
