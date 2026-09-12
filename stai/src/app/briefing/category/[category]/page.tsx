import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allArticles } from "@/lib/content";
import { CATEGORIES, CATEGORY_COPY, categoryFromSlug, categorySlug } from "@/lib/categories";
import { pageMeta, abs, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { fmtDate } from "@/lib/format";
import { PlusBadge } from "@/components/Logo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: categorySlug(c) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = categoryFromSlug(category);
  if (!cat) return {};
  const copy = CATEGORY_COPY[cat];
  return pageMeta({
    title: copy.seoTitle,
    description: copy.seoDescription,
    path: `/briefing/category/${categorySlug(cat)}`,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = categoryFromSlug(category);
  if (!cat) notFound();

  const items = allArticles().filter((a) => a.category === cat);
  const copy = CATEGORY_COPY[cat];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "STAI", path: "/" },
            { name: "The Briefing", path: "/briefing" },
            { name: cat, path: `/briefing/category/${categorySlug(cat)}` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: copy.seoTitle,
            description: copy.seoDescription,
            url: abs(`/briefing/category/${categorySlug(cat)}`),
            isPartOf: { "@id": abs("/#website") },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: items.length,
              itemListElement: items.map((a, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: abs(`/briefing/${a.slug}`),
                name: a.title,
              })),
            },
          },
        ]}
      />

      <nav className="f-mono text-[0.68rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }} aria-label="Breadcrumb">
        <Link href="/briefing" className="hover:text-cream-100">
          The Briefing
        </Link>{" "}
        / {cat}
      </nav>

      <header className="mt-3 max-w-3xl">
        <h1 className="f-display text-4xl text-cream-100 sm:text-6xl">{cat}</h1>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          {copy.blurb}
        </p>
        <p className="f-mono mt-4 text-[0.68rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
          {items.length} {items.length === 1 ? "piece" : "pieces"} on this beat
        </p>
      </header>

      <ol className="mt-10">
        {items.map((a, i) => (
          <li key={a.id} className="border-t rule last:border-b">
            <Link href={`/briefing/${a.slug}`} className="group grid gap-x-6 gap-y-1 py-6 sm:grid-cols-[4rem_1fr] sm:items-baseline">
              <span className="index-num">{String(i + 1).padStart(2, "0")} /</span>
              <span>
                <h2 className="f-display-wide text-xl text-cream-100 transition-colors group-hover:text-white sm:text-2xl">
                  {a.title}
                  {a.premium && (
                    <span className="ml-3 align-middle">
                      <PlusBadge />
                    </span>
                  )}
                </h2>
                <span className="mt-2 block max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {a.dek}
                </span>
                <span className="f-mono mt-2 block text-[0.62rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                  {a.author} · <time dateTime={a.published_at}>{fmtDate(a.published_at)}</time> · {a.reading_min} min
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <nav className="mt-12 border-t pt-6 rule" aria-label="Other beats">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Other beats
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c !== cat).map((c) => (
            <Link
              key={c}
              href={`/briefing/category/${categorySlug(c)}`}
              className="f-mono border px-3 py-1.5 text-[0.68rem] tracking-[0.12em] uppercase rule text-cream-400 transition-colors hover:border-[var(--line-strong)] hover:text-cream-100"
            >
              {c}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
