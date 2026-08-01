import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articleBySlug, relatedArticles } from "@/lib/content";
import { renderMarkdown, markdownPreview } from "@/lib/markdown";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import ReadingProgress from "@/components/briefing/ReadingProgress";
import BookmarkButton from "@/components/BookmarkButton";
import { IndexCard } from "@/components/ArticleCard";
import { PlusBadge } from "@/components/Logo";
import JsonLd from "@/components/JsonLd";
import { pageMeta, abs, breadcrumbSchema } from "@/lib/seo";
import { authorSlug } from "@/lib/authors";
import { categorySlug } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return {};
  return pageMeta({
    title: a.title,
    description: a.dek,
    path: `/briefing/${a.slug}`,
    type: "article",
    publishedTime: a.published_at,
    authors: [a.author],
    section: a.category,
    tags: a.tags,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = articleBySlug(slug);
  if (!article) notFound();

  const user = await currentUser();
  const locked = article.premium && user?.plan !== "plus";
  // Locked pieces are cut server-side — the full text never reaches the client.
  const source = locked ? markdownPreview(article.body_md, 3) : article.body_md;
  const { html, toc } = renderMarkdown(source);
  const related = relatedArticles(article, 4);
  const [readNext, ...alsoOnDesk] = related;
  const bookmarked = user
    ? !!db()
        .prepare("SELECT 1 FROM bookmarks WHERE user_id=? AND kind='article' AND ref_id=?")
        .get(user.id, article.id)
    : false;

  // Paywalled pieces declare the gate explicitly. Serving truncated HTML
  // WITHOUT this markup is what Google treats as cloaking; with it, the
  // article is indexed honestly and the locked section is disclosed.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "AnalysisNewsArticle",
    "@id": abs(`/briefing/${article.slug}#article`),
    headline: article.title,
    description: article.dek,
    datePublished: article.published_at,
    dateModified: article.published_at,
    inLanguage: "en-GB",
    articleSection: article.category,
    keywords: article.tags.join(", "),
    wordCount: article.body_md.split(/\s+/).length,
    timeRequired: `PT${article.reading_min}M`,
    url: abs(`/briefing/${article.slug}`),
    mainEntityOfPage: { "@type": "WebPage", "@id": abs(`/briefing/${article.slug}`) },
    author: {
      "@type": "Person",
      name: article.author,
      jobTitle: article.author_role,
      url: abs(`/authors/${authorSlug(article.author)}`),
    },
    publisher: { "@id": abs("/#organization") },
    isAccessibleForFree: !article.premium,
    ...(article.premium
      ? {
          hasPart: {
            "@type": "WebPageElement",
            isAccessibleForFree: false,
            cssSelector: ".stai-paywalled",
          },
        }
      : {}),
  };

  return (
    <>
      <JsonLd
        data={[
          articleSchema,
          breadcrumbSchema([
            { name: "STAI", path: "/" },
            { name: "The Briefing", path: "/briefing" },
            { name: article.category, path: `/briefing/category/${categorySlug(article.category)}` },
            { name: article.title, path: `/briefing/${article.slug}` },
          ]),
        ]}
      />
      <ReadingProgress />
      <article className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Header and body share one grid so the headline sits on the same
            left edge as the prose; the file rail runs beside the text.
            Measure is capped at 40rem ≈ 68 characters — the comfortable
            long-form range. */}
        <div className="mx-auto grid max-w-2xl gap-x-14 lg:max-w-none lg:grid-cols-[13rem_minmax(0,40rem)] lg:justify-center">
        {/* head */}
        <header className="lg:col-start-2 lg:row-start-1">
          <p className="f-mono text-[0.68rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
            <Link href="/briefing" className="hover:text-cream-100">
              The Briefing
            </Link>{" "}
            /{" "}
            <Link href={`/briefing/category/${categorySlug(article.category)}`} className="hover:text-cream-100">
              {article.category}
            </Link>
            {article.premium && (
              <span className="ml-3 align-middle">
                <PlusBadge />
              </span>
            )}
          </p>
          <h1 className="f-display mt-4 text-[clamp(2.2rem,6vw,4.2rem)] text-cream-100">{article.title}</h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            {article.dek}
          </p>
        </header>

          {/* file rail */}
          <aside className="mt-10 lg:sticky lg:top-32 lg:col-start-1 lg:row-start-2 lg:self-start">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 rule lg:grid-cols-1">
              <div>
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  File ref
                </p>
                <p className="f-mono mt-1 text-[0.78rem] text-cream-200">STAI-BRF-{String(article.id).padStart(3, "0")}</p>
              </div>
              <div>
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  Published
                </p>
                <p className="f-mono mt-1 text-[0.78rem] tabular-nums text-cream-200">
                  <time dateTime={article.published_at}>{fmtDate(article.published_at)}</time>
                </p>
              </div>
              <div>
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  Author
                </p>
                <p className="mt-1 text-[0.85rem]">
                  <Link
                    href={`/authors/${authorSlug(article.author)}`}
                    rel="author"
                    className="text-cream-200 underline-offset-4 hover:text-cream-100 hover:underline"
                  >
                    {article.author}
                  </Link>
                </p>
                <p className="f-mono text-[0.62rem] tracking-[0.08em] uppercase" style={{ color: "var(--ink-faint)" }}>
                  {article.author_role}
                </p>
              </div>
              <div>
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  Reading time
                </p>
                <p className="f-mono mt-1 text-[0.78rem] text-cream-200">{article.reading_min} min</p>
              </div>
              <div className="col-span-2 lg:col-span-1">
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  Tags
                </p>
                <p className="f-mono mt-1 text-[0.68rem] leading-relaxed tracking-[0.04em] text-cream-400">
                  {article.tags.join(" · ")}
                </p>
              </div>
            </div>

            {toc.length > 1 && !locked && (
              <nav className="mt-5 hidden lg:block" aria-label="In this briefing">
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  In this briefing
                </p>
                <ol className="mt-2 space-y-1.5">
                  {toc.map((t, i) => (
                    <li key={t.id}>
                      <a href={`#${t.id}`} className="group flex gap-2 text-[0.8rem] leading-snug text-cream-400 hover:text-cream-100">
                        <span className="index-num shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span>{t.text}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className="mt-5 flex gap-2">
              <BookmarkButton kind="article" refId={article.id} initial={bookmarked} authed={!!user} />
            </div>
          </aside>

          {/* body */}
          <div className="mt-10 lg:col-start-2 lg:row-start-2">
            <div className={locked ? "veil stai-paywalled" : undefined}>
              <div className="prose-stai" dangerouslySetInnerHTML={{ __html: html }} />
            </div>

            {locked && (
              <div
                className="mt-2 border p-6"
                style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.05)" }}
              >
                <p className="f-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-gold-300">
                  STAI+ briefing
                </p>
                <h2 className="f-display mt-2 text-2xl text-cream-100">The rest of this piece is for members.</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  STAI+ unlocks every briefing, the full prompt library with adapt-with-AI, and unlimited Ask
                  STAI — €19/month, €149/year, or €12/month locked forever as a founding member.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/plus" className="btn btn-plus premium-focus">
                    Unlock with STAI+
                  </Link>
                  {!user && (
                    <Link href={`/login?next=/briefing/${article.slug}`} className="btn btn-ghost">
                      Already a member? Sign in
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!locked && (
              <footer className="mt-12 border-t pt-6 rule">
                <p className="f-mono text-[0.65rem] leading-relaxed tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
                  CITE THIS BRIEFING — {article.author}, “{article.title}”, STAI, {fmtDate(article.published_at)},
                  stai.ai/briefing/{article.slug}
                </p>
              </footer>
            )}
          </div>
        </div>

        {/* Read next — one decisive continuation, not a menu of three.
            A reader who finishes a piece wants the next piece, not a choice. */}
        {readNext && (
          <section className="mx-auto mt-16 max-w-4xl">
            <Link
              href={`/briefing/${readNext.slug}`}
              className="group block border p-6 transition-colors rule hover:border-[var(--line-strong)] sm:p-8"
            >
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                Read next · {readNext.category} · {readNext.reading_min} min
              </p>
              <h2 className="f-display mt-3 text-2xl text-cream-100 transition-colors group-hover:text-white sm:text-4xl">
                {readNext.title}
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                {readNext.dek}
              </p>
              <p className="f-mono mt-4 text-[0.7rem] tracking-[0.14em] uppercase text-cream-400">
                Continue <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </p>
            </Link>
          </section>
        )}

        {/* related */}
        {alsoOnDesk.length > 0 && (
          <section className="mx-auto mt-14 max-w-7xl">
            <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
              Also on the desk
            </h2>
            <div className="mt-6 grid gap-8 md:grid-cols-3">
              {alsoOnDesk.map((r, i) => (
                <IndexCard key={r.id} a={r} num={String(i + 1).padStart(2, "0")} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
