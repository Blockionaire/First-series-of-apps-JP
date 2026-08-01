import type { Metadata } from "next";

export const SITE = {
  url: "https://stai.ai",
  name: "STAI",
  legalName: "STAI — Signal & Training for Audit Intelligence",
  tagline: "Signal & training for audit intelligence",
  description:
    "The intelligence platform for audit, accountancy and finance professionals across Europe. Editorial analysis, an audit-grade AI prompt library, a grounded research assistant, podcasts, and live training for firms.",
  locale: "en_GB",
  twitter: "@stai_ai",
  city: "Amsterdam",
} as const;

/** Absolute URL for a site-relative path. */
export function abs(path = "/"): string {
  return new URL(path, SITE.url).toString();
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  /** Route-segment OG images are picked up automatically; pass false to opt out. */
  images?: string[];
  type?: "website" | "article";
  publishedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
  noIndex?: boolean;
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
    authors,
    section,
    tags,
    noIndex,
  } = input;

  const url = abs(path);

  return {
    title,
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

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": abs("/#organization"),
    name: SITE.name,
    legalName: SITE.legalName,
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
