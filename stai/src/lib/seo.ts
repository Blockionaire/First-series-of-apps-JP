import type { Metadata } from "next";
import { publicUrl } from "./config";
import { COMPANY } from "./company";

export const SITE = {
  // Follows APP_URL so canonicals, OG URLs and the sitemap match wherever
  // this is deployed; falls back to the production domain.
  url: publicUrl(),
  name: "STAI",
  /**
   * The slogan, without the "STAI — " prefix: it is rendered as
   * `STAI — ${tagline}` in the page title and the hero, so carrying the name
   * here as well would print it twice.
   *
   * This is the single source. The hero, the About headline, the browser tab
   * title, the Organization schema's `slogan` and the OG card all read it,
   * because a brand line copied into six files is a brand line that ends up
   * saying six different things.
   */
  tagline: "The platform to stay ahead of AI in audit & finance",
  description:
    "The intelligence platform for audit, accountancy and finance professionals across Europe. Editorial analysis of AI regulation and standards, an audit-grade prompt library, a grounded research assistant, and live training for firms.",
  locale: "en_GB",
  twitter: "@stai_ai",
  city: "Amsterdam",
} as const;

/** Absolute URL for a site-relative path. */
export function abs(path = "/"): string {
  return new URL(path, SITE.url).toString();
}

/** The host, without scheme — what IndexNow and similar APIs ask for. */
export function siteHost(): string {
  return new URL(SITE.url).host;
}

/**
 * Search-engine ownership tokens, when they are configured.
 *
 * Google Search Console and Bing Webmaster Tools both accept a meta tag as
 * proof of ownership. The token is not a secret — it ends up in the HTML of
 * every page — but it is deployment-specific, so it comes from the
 * environment rather than from Git: a preview deployment should not claim
 * ownership of the production property.
 *
 * Absent env vars produce no tags at all, which is the correct behaviour for
 * local development. Verification is an operator step in each dashboard; this
 * only supplies the tag the dashboard looks for.
 */
export function verificationMeta(): Metadata["verification"] | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    // Bing has no first-class field in Next's Metadata type; its tag name is
    // `msvalidate.01`, which is what `other` exists for.
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  /** Route-segment OG images are picked up automatically; pass false to opt out. */
  images?: string[];
  type?: "website" | "article";
  publishedTime?: string;
  /**
   * When the piece was last substantively changed. Emitted as
   * `article:modified_time`, which is the OpenGraph counterpart of the
   * `dateModified` in the page's structured data — the two disagreeing is a
   * recency signal a crawler has to arbitrate, so both come from the same
   * source (lib/article-dates.ts).
   */
  modifiedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
  noIndex?: boolean;
  /**
   * Skip the root layout's `%s — STAI` title template.
   *
   * Only the homepage needs this: its title already names the brand, so the
   * template would print it twice.
   */
  absoluteTitle?: boolean;
};

/**
 * One metadata builder for every route: guarantees a canonical URL and a
 * complete OpenGraph/Twitter card on each page rather than title-only tags.
 */
export function pageMeta(input: PageMetaInput): Metadata {
  const {
    title,
    description,
    path,
    images,
    type = "website",
    publishedTime,
    modifiedTime,
    authors,
    section,
    tags,
    noIndex,
    absoluteTitle,
  } = input;

  const url = abs(path);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    ...(noIndex
      ? { robots: { index: false, follow: false, nocache: true } }
      : {
          robots: {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
          },
        }),
    openGraph: {
      type,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      title,
      description,
      ...(images ? { images } : {}),
      ...(type === "article"
        ? {
            publishedTime,
            modifiedTime,
            authors,
            section,
            tags,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images } : {}),
    },
  };
}

/**
 * Who the publisher is, in machine-readable form.
 *
 * `legalName` means the registered name of the operating entity, not a
 * marketing line. It used to carry a slogan the site no longer uses, which
 * told every consumer of this schema — including the AI assistants that read
 * it to attribute a citation — something that was both stale and false in
 * kind. It now comes from lib/company.ts, the single record of the operator's
 * registration details, and is omitted while that record is still blank:
 * asserting nothing is correct, asserting a slogan is not.
 */
export function organizationSchema() {
  const legalName = COMPANY.legalName.trim();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": abs("/#organization"),
    name: SITE.name,
    ...(legalName ? { legalName } : {}),
    url: SITE.url,
    description: SITE.description,
    slogan: SITE.tagline,
    address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: "NL" },
    knowsAbout: [
      "EU AI Act",
      "Audit methodology",
      "ISQM 1",
      "ISA 230",
      "ISA 240",
      "CSRD assurance",
      "ESRS",
      "Artificial intelligence in audit",
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": abs("/#website"),
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "en-GB",
    publisher: { "@id": abs("/#organization") },
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: abs(t.path),
    })),
  };
}
