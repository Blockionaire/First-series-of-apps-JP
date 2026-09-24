import Link from "next/link";
import { preload } from "react-dom";
import { allArticles, featuredArticles, allPrompts, type ArticleSummary } from "@/lib/content";
import { fmtDate } from "@/lib/format";
import Reveal from "@/components/Reveal";
import NewsletterForm from "@/components/NewsletterForm";
import { PlusBadge } from "@/components/Logo";
import Workbench from "@/components/home/Workbench";
import { SITE, pageMeta } from "@/lib/seo";
import { enabledMap, homeCopy } from "@/lib/site-config";

export const dynamic = "force-dynamic";

/**
 * The homepage states its own canonical like every other page.
 *
 * It used to inherit one from the root layout, which happened to be correct
 * here and wrong everywhere else. `absoluteTitle` because this title already
 * carries the brand and the layout's `%s — STAI` template would repeat it.
 */
export const metadata = pageMeta({
  title: `STAI — ${SITE.tagline}`,
  description: SITE.description,
  path: "/",
  absoluteTitle: true,
});

/* ───────────────────────────────────────────────────────────────────────────
 * HOMEPAGE — EDITORIAL CONCEPT ("paper edition")
 *
 * The public, editorial face of STAI: a publication front page first, the
 * tools second. Styles live in the "HOMEPAGE EDITORIAL CONCEPT" block at the
 * end of globals.css and apply only while `.home-ed` is on the page.
 *
 * Every piece of content is either real data (articles, prompts, settings
 * copy) or a true, dated statement. Nothing here is invented to fill space.
 * ─────────────────────────────────────────────────────────────────────────── */

/** The day, the way a front page prints it, in the desk's own timezone. */
function editionDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(now);
}

/** Split a headline's closing full stop off so it can take the accent. */
function withStop(text: string): [string, string] {
  const m = /^(.*?)([.!?])$/.exec(text.trim());
  return m ? [m[1], m[2]] : [text, ""];
}

function Meta({ a, withAuthor = false }: { a: ArticleSummary; withAuthor?: boolean }) {
  return (
    <p className="ed-meta flex flex-wrap gap-x-3 gap-y-1">
      <span className="text-cream-400">{a.category}</span>
      <span aria-hidden>·</span>
      <time dateTime={a.published_at}>{fmtDate(a.published_at)}</time>
      <span aria-hidden>·</span>
      <span>{a.reading_min} min</span>
      {withAuthor && (
        <>
          <span aria-hidden>·</span>
          <span>{a.author}</span>
        </>
      )}
      {a.premium && <PlusBadge />}
    </p>
  );
}

/** A section's opening line: number, name, and an optional way onward. */
function SectionHead({ n, label, title, link }: { n: string; label: string; title: React.ReactNode; link?: { href: string; text: string } }) {
  return (
    <div className="grid gap-6 border-t pt-6 rule-strong md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_auto] md:items-baseline">
      <p className="ed-meta">
        <span className="text-cream-400">{n}</span> — {label}
      </p>
      <h2 className="ed-display text-[clamp(2.1rem,4.4vw,3.6rem)]">{title}</h2>
      {link && (
        <Link href={link.href} className="ed-link text-sm md:justify-self-end">
          {link.text}
        </Link>
      )}
    </div>
  );
}

export default async function Home() {
  // The serif carries the first impression; fetch it with the document.
  preload("/fonts/eb-garamond-latin-wght-normal.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/eb-garamond-latin-wght-italic.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  const featured = await featuredArticles();
  const latest = await allArticles(6);
  const lead = featured[0] ?? latest[0];
  const secondary = (featured.length > 1 ? featured.slice(1, 4) : latest.slice(1, 4)).filter((a) => a.id !== lead?.id);
  const shown = new Set([lead?.id, ...secondary.map((a) => a.id)]);
  const wire = latest.filter((a) => !shown.has(a.id)).slice(0, 4);

  const prompts = await allPrompts();
  const benchPrompts = prompts
    .filter((p) => !p.premium)
    .slice(0, 3)
    .concat(prompts.filter((p) => p.premium).slice(0, 1))
    .map((p) => ({ slug: p.slug, title: p.title, category: p.category, premium: p.premium }));

  // The homepage's own words, and which sections it may show. Both come from
  // site settings, so an operator can change the headline or close a section
  // without a deploy — and a closed section never renders a link into a 404.
  const copy = await homeCopy();
  const on = await enabledMap();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const aiActApplies = today >= "2026-08-02";
  const [line1, stop1] = withStop(copy["home.headline"] || "AI is rewriting the audit.");
  const [line2, stop2] = withStop(copy["home.headline2"] || "");
  const cta2Href = copy["home.cta2.href"] || "#briefing";
  const showCta2 = Boolean(copy["home.cta2.label"]) && (!cta2Href.startsWith("#briefing") || on.newsletter);

  const system = [
    on.news && { href: "/news", name: "News", role: "What changed", line: "Dated reporting on regulation, standards and enforcement." },
    on.insights && { href: "/insights", name: "Insights", role: "What it means", line: "Analysis that connects a development to audit methodology." },
    on.newsletter && { href: "#briefing", name: "The Briefing", role: "What matters", line: "The week in one considered read." },
    on.prompts && { href: "/prompts", name: "Prompts", role: "Put it to work", line: "Audit-grade prompts, written like methodology." },
    on.aiAct && { href: "/ai-act", name: "AI Act", role: "Track what is moving", line: "Obligations, dates and articles, kept current." },
    on.ask && { href: "/ask", name: "Ask STAI", role: "Ask the evidence", line: "Answers from STAI’s own reporting, every claim cited." },
  ].filter(Boolean) as { href: string; name: string; role: string; line: string }[];

  return (
    <div className="home-ed">
      {/* ═══ A. Hero ═══════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Masthead line: the page dated like a front page. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b py-4 rule">
          <p className="ed-meta">{copy["home.eyebrow"] || "The intelligence layer for AI in audit"}</p>
          <p className="ed-meta">{editionDate(now)} · Amsterdam</p>
        </div>

        <div className="pb-16 pt-16 sm:pt-24 lg:pb-24 lg:pt-32">
          <h1 className="ed-display max-w-[15ch] text-[clamp(3rem,9.2vw,8.6rem)] sm:max-w-none">
            <span className="block">
              {line1}
              <span className="ed-accent">{stop1}</span>
            </span>
            {line2 && (
              <span className="ed-italic block text-cream-400">
                {line2}
                <span className="ed-accent">{stop2}</span>
              </span>
            )}
          </h1>

          <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,1fr)_minmax(0,4fr)] lg:items-end">
            <div>
              <p className="ed-body max-w-[34rem] text-[1.15rem] sm:text-[1.25rem]">{copy["home.sub"]}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                {copy["home.cta1.label"] && (
                  <Link href={copy["home.cta1.href"] || "/news"} className="ed-btn ed-btn-primary">
                    {copy["home.cta1.label"]} <span className="ed-arrow" aria-hidden>→</span>
                  </Link>
                )}
                {showCta2 && (
                  <Link href={cta2Href} className="ed-btn ed-btn-quiet">
                    {copy["home.cta2.label"]}
                  </Link>
                )}
              </div>
            </div>
            <ul className="lg:col-start-3" aria-label="What STAI tells you">
              {["Know what changed.", "Know what matters.", "Know what to do next."].map((t, i) => (
                <li key={t} className="flex items-baseline gap-5 border-t py-3 rule last:border-b">
                  <span className="ed-meta w-6">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ed-serif text-[1.45rem] leading-tight text-cream-100 sm:text-[1.65rem]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* A restrained live signal: real dates, no counters. */}
        <div className="flex flex-col gap-2 border-t py-4 rule sm:flex-row sm:items-baseline sm:justify-between">
          {latest[0] && (
            <Link href={`/briefing/${latest[0].slug}`} className="group ed-meta flex min-w-0 items-baseline gap-3">
              <span className="text-cream-400">Latest</span>
              <time dateTime={latest[0].published_at}>{fmtDate(latest[0].published_at)}</time>
              <span className="truncate font-sans normal-case tracking-normal text-[0.85rem] text-cream-200">
                <span className="ed-hl">{latest[0].title}</span>
              </span>
            </Link>
          )}
          <p className="ed-meta shrink-0">
            EU AI Act · most obligations {aiActApplies ? "apply since" : "apply from"} 02 Aug 2026
          </p>
        </div>
      </section>

      {/* ═══ B. Latest intelligence — the front page ═════════════════════════ */}
      {lead && (
        <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:pt-28" aria-labelledby="latest-heading">
          <div id="latest-heading">
            <SectionHead
              n="01"
              label="Latest intelligence"
              title={<>What changed <span className="ed-italic">this week</span></>}
              link={on.news ? { href: "/news", text: "All intelligence" } : undefined}
            />
          </div>

          <div className="mt-12 grid gap-14 lg:mt-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
            {/* The lead: visibly the most important thing on the page. */}
            <article className="group">
              <Link href={`/briefing/${lead.slug}`} className="block">
                <div className="ed-plate" aria-hidden>
                  <p className="ed-meta absolute left-7 top-7">Lead story</p>
                  <p className="ed-meta absolute right-7 top-7">{lead.kind === "insight" ? "Insight" : "News"}</p>
                  <span className="ed-plate-rule absolute left-7 top-14 h-px w-10" />
                  <p className="ed-meta absolute bottom-7 right-7 hidden sm:block">{fmtDate(lead.published_at)}</p>
                  <p className="ed-display ed-italic absolute bottom-6 left-7 right-7 text-[clamp(2.6rem,6vw,5rem)]">
                    {lead.category}
                  </p>
                </div>
                <div className="mt-7">
                  <Meta a={lead} />
                </div>
                <h3 className="ed-display mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.02]">
                  <span className="ed-hl">{lead.title}</span>
                </h3>
                <p className="ed-body mt-5 max-w-2xl">{lead.dek}</p>
                <p className="mt-5 text-sm text-cream-400">
                  By <span className="text-cream-100">{lead.author}</span>
                  {lead.author_role ? <span>, {lead.author_role}</span> : null}
                </p>
              </Link>
            </article>

            {/* Secondary stories: ruled, not boxed. */}
            <div>
              {secondary.map((a, i) => (
                <Reveal key={a.id} delay={i * 90}>
                  <article className={`group border-t py-7 rule ${i === 0 ? "lg:border-t-0 lg:pt-0" : ""}`}>
                    <Link href={`/briefing/${a.slug}`} className="block">
                      <Meta a={a} />
                      <h3 className="ed-serif mt-3 text-[1.6rem] leading-[1.12] text-cream-100 sm:text-[1.8rem]">
                        <span className="ed-hl">{a.title}</span>
                      </h3>
                      <p className="mt-3 line-clamp-2 text-[0.95rem] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                        {a.dek}
                      </p>
                      <p className="mt-3 text-[0.85rem] text-cream-400">By {a.author}</p>
                    </Link>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>

          {/* On the wire: the rest of the week, as a quiet list. */}
          {wire.length > 0 && (
            <div className="mt-16 border-t pt-6 rule-strong">
              <p className="ed-meta">Also on the desk</p>
              <ul className="mt-4 grid gap-x-10 sm:grid-cols-2">
                {wire.map((a) => (
                  <li key={a.id} className="border-b rule">
                    <Link href={`/briefing/${a.slug}`} className="group flex items-baseline gap-5 py-4">
                      <time dateTime={a.published_at} className="ed-meta w-14 shrink-0">
                        {fmtDate(a.published_at).slice(0, 6)}
                      </time>
                      <span className="min-w-0 flex-1 text-[1rem] leading-snug text-cream-100">
                        <span className="ed-hl">{a.title}</span>
                      </span>
                      <span className="ed-meta hidden shrink-0 md:inline">{a.category}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ═══ C. Point of view ═══════════════════════════════════════════════ */}
      <section className="ed-night mt-24 lg:mt-36" aria-labelledby="pov-heading">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-36">
          <p className="ed-meta">
            <span className="text-cream-400">02</span> — Point of view
          </p>
          <h2 id="pov-heading" className="ed-display mt-10 text-[clamp(3rem,8.5vw,8rem)]">
            <span className="block">AI moves fast.</span>
            <span className="ed-italic block text-cream-400">
              Audit cannot guess<span className="ed-accent">.</span>
            </span>
          </h2>
          <div className="mt-20 grid gap-10 md:grid-cols-3 lg:mt-28">
            {[
              ["Evidence before hype.", "Every claim is dated, sourced and traceable to the text that makes it true."],
              ["Judgement stays human.", "Tools can draft, sort and summarise. Signing an opinion remains a professional act."],
              ["Practical, not promotional.", "If it does not change what a team does on an engagement, it does not lead."],
            ].map(([h, t]) => (
              <Reveal key={h}>
                <div className="border-t pt-5 rule-strong">
                  <p className="ed-serif text-[1.6rem] leading-tight text-cream-100">{h}</p>
                  <p className="mt-3 max-w-sm text-[0.95rem] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {t}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ D. The intelligence system — a table of contents ═══════════════ */}
      {system.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:pt-36">
          <SectionHead n="03" label="The intelligence layer" title={<>From signal <span className="ed-italic">to working paper</span></>} />
          <p className="ed-body mt-6 max-w-xl md:ml-[25%]">
            One evidence base behind all of it. Everything STAI publishes and builds draws on the same sourced, dated record.
          </p>
          <ul className="mt-14 border-t rule-strong">
            {system.map((s, i) => (
              <li key={s.name} className="border-b rule">
                <Link
                  href={s.href}
                  className="ed-row group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 px-1 py-6 md:grid-cols-[4rem_minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,3fr)_2rem] md:py-8"
                >
                  <span className="ed-meta">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ed-display text-[clamp(1.9rem,3.4vw,3rem)]">{s.name}</span>
                  <span className="ed-arrow text-xl text-cream-400 md:order-last" aria-hidden>
                    →
                  </span>
                  <span className="ed-serif ed-italic col-start-2 text-[1.25rem] text-cream-400 md:col-start-auto md:text-[1.45rem]">
                    {s.role}
                  </span>
                  <span className="col-start-2 text-[0.95rem] leading-relaxed md:col-start-auto" style={{ color: "var(--ink-muted)" }}>
                    {s.line}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═══ E. Evidence ═══════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:pt-36" aria-labelledby="evidence-heading">
        <div className="border-t pt-6 rule-strong">
          <p className="ed-meta">
            <span className="text-cream-400">04</span> — Evidence
          </p>
        </div>
        <div className="mt-10 grid gap-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
          <div>
            <h2 id="evidence-heading" className="ed-display text-[clamp(2.6rem,5.6vw,5rem)]">
              <span className="block">Evidence first.</span>
              <span className="ed-italic block text-cream-400">Interpretation second.</span>
            </h2>
            <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {[
                ["Primary sources", "Regulation is cited to the text itself, not to someone’s summary of it."],
                ["Source tiers", "Issuing bodies settle facts. Commentary adds context. Chatter only starts a search."],
                ["Clear jurisdiction", "EU, member-state and UK rules are not the same thing, and we say which one we mean."],
                ["Human review", "An editor stands behind every published piece. Nothing is claimed that cannot be shown."],
              ].map(([k, v]) => (
                <div key={k} className="border-t pt-4 rule">
                  <dt className="ed-meta text-cream-400">{k}</dt>
                  <dd className="mt-2 text-[0.98rem] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* A specimen of how one claim is recorded. The claim is true and the
              citation is real: the AI Act's application date, Art. 113. */}
          <Reveal>
            <figure className="ed-bench self-start p-6 sm:p-8">
              <figcaption className="ed-meta flex items-center justify-between border-b pb-4 rule">
                <span>How a claim is recorded</span>
                <span className="text-cream-400">Specimen</span>
              </figcaption>
              <p className="ed-serif mt-6 text-[1.7rem] leading-snug text-cream-100">
                “Most obligations of the EU AI Act apply from 2 August 2026.”
              </p>
              <dl className="f-mono mt-8 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-y-3 text-[0.74rem] leading-relaxed">
                {[
                  ["Primary text", "Regulation (EU) 2024/1689, Art. 113"],
                  ["Source tier", "Tier 1 — the issuing body"],
                  ["Jurisdiction", "EU"],
                  ["Support", "Supported · primary source"],
                  ["Review", "Editor, before publication"],
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="uppercase tracking-[0.12em]" style={{ color: "var(--ink-faint)" }}>
                      {k}
                    </dt>
                    <dd className="text-cream-100">{v}</dd>
                  </div>
                ))}
              </dl>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ═══ F. The Briefing ═══════════════════════════════════════════════ */}
      {on.newsletter && (
        <section id="briefing" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-24 sm:px-6 lg:pt-36" aria-labelledby="briefing-heading">
          <div className="grid gap-14 border-t pt-6 rule-strong lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
            <div>
              <p className="ed-meta">
                <span className="text-cream-400">05</span> — The Briefing
              </p>
              <h2 id="briefing-heading" className="ed-display mt-10 text-[clamp(2.6rem,5.2vw,4.6rem)]">
                <span className="block">The Briefing.</span>
                <span className="ed-italic block text-cream-400">Weekly. Only what matters.</span>
              </h2>
              <p className="ed-body mt-8 max-w-md">
                One considered read on the regulatory moves and standards signals that matter to European audit and
                finance. It has not started yet — join the list and the first issue comes to you.
              </p>
              <div className="mt-8 max-w-md">
                <NewsletterForm source="home" />
              </div>
              <p className="ed-meta mt-4">No spam · one email when it starts</p>
            </div>

            {/* A preview set like the publication it will be — built from the
                desk's latest real reporting, not a fabricated issue. */}
            <div className="border p-7 rule sm:p-10" style={{ background: "var(--color-navy-850)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-4 rule">
                <p className="ed-serif text-[1.35rem] text-cream-100">
                  The Briefing <span className="ed-italic text-cream-400">— preview</span>
                </p>
                <p className="ed-meta">From this week’s desk</p>
              </div>
              <ol className="mt-2">
                {latest.slice(0, 3).map((a, i) => (
                  <li key={a.id} className="border-b rule last:border-b-0">
                    <Link href={`/briefing/${a.slug}`} className="group grid grid-cols-[2.2rem_minmax(0,1fr)] gap-x-3 py-6">
                      <span className="ed-serif ed-italic text-[1.5rem] leading-none text-cream-400">{i + 1}</span>
                      <span>
                        <span className="ed-meta block">{a.category}</span>
                        <span className="ed-serif mt-2 block text-[1.4rem] leading-snug text-cream-100">
                          <span className="ed-hl">{a.title}</span>
                        </span>
                        <span className="mt-2 line-clamp-2 text-[0.92rem] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                          {a.dek}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* ═══ G. The workbench — where the page turns engineered ═════════════ */}
      {(on.prompts || on.aiAct || on.ask || on.assessment) && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:pt-36" aria-labelledby="bench-heading">
          <div className="border-t pt-6 rule-strong">
            <p className="ed-meta">
              <span className="text-cream-400">06</span> — The workbench
            </p>
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-end">
            <h2 id="bench-heading" className="ed-display text-[clamp(2.6rem,5.2vw,4.6rem)]">
              <span className="block">The work gets faster.</span>
              <span className="ed-italic block text-cream-400">The accountability does not.</span>
            </h2>
            <p className="ed-body max-w-md">
              Instruments built on the same evidence: prompts written like methodology, an AI Act tracker, grounded
              answers and a diagnostic for your firm.
            </p>
          </div>
          <div className="mt-12">
            <Workbench
              prompts={benchPrompts}
              today={today}
              show={{ prompts: on.prompts, aiAct: on.aiAct, ask: on.ask, assessment: on.assessment, plus: on.plus }}
            />
          </div>
        </section>
      )}

      {/* ═══ H. Close ═══════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:pb-36 lg:pt-44">
        <h2 className="ed-display text-center text-[clamp(2.8rem,7.4vw,6.8rem)]">
          Stay ahead of AI <span className="ed-italic">in audit</span>
          <span className="ed-accent">.</span>
        </h2>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Link href={on.news ? "/news" : "/insights"} className="ed-btn ed-btn-primary">
            Explore STAI <span className="ed-arrow" aria-hidden>→</span>
          </Link>
          {on.newsletter && (
            <Link href="#briefing" className="ed-btn ed-btn-quiet">
              Join The Briefing
            </Link>
          )}
        </div>
        {(on.training || on.podcast || on.plus) && (
          <p className="ed-meta mt-16 flex flex-wrap justify-center gap-x-6 gap-y-2">
            <span>Also from STAI</span>
            {on.training && (
              <Link href="/training" className="text-cream-400 hover:text-cream-100">
                Training for firms
              </Link>
            )}
            {on.podcast && (
              <Link href="/podcast" className="text-cream-400 hover:text-cream-100">
                Podcast
              </Link>
            )}
            {on.plus && (
              <Link href="/plus" className="text-gold-300 hover:underline premium-focus">
                STAI+ early access — not yet on sale
              </Link>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
