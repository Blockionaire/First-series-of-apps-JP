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

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return {};
  return { title: a.title, description: a.dek };
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
  const related = relatedArticles(article);
  const bookmarked = user
    ? !!db()
        .prepare("SELECT 1 FROM bookmarks WHERE user_id=? AND kind='article' AND ref_id=?")
        .get(user.id, article.id)
    : false;

  return (
    <>
      <ReadingProgress />
      <article className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* head */}
        <header className="mx-auto max-w-3xl">
          <p className="f-mono text-[0.68rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
            <Link href="/briefing" className="hover:text-cream-100">
              The Briefing
            </Link>{" "}
            / {article.category}
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

        <div className="mx-auto mt-10 grid max-w-3xl gap-10 lg:max-w-none lg:grid-cols-[15rem_minmax(0,46rem)] lg:justify-center lg:gap-16">
          {/* file rail */}
          <aside className="lg:sticky lg:top-32 lg:self-start">
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
                <p className="f-mono mt-1 text-[0.78rem] tabular-nums text-cream-200">{fmtDate(article.published_at)}</p>
              </div>
              <div>
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  Author
                </p>
                <p className="mt-1 text-[0.85rem] text-cream-200">{article.author}</p>
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
          <div>
            <div className={locked ? "veil" : undefined}>
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

        {/* related */}
        <section className="mx-auto mt-16 max-w-7xl">
          <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
            Also on the desk
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            {related.map((r, i) => (
              <IndexCard key={r.id} a={r} num={String(i + 1).padStart(2, "0")} />
            ))}
          </div>
        </section>
      </article>
    </>
  );
}
