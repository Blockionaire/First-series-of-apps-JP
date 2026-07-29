import Link from "next/link";
import {
  allArticles,
  featuredArticles,
  allPrompts,
  foundingStatus,
  EARLY_BIRD_END_ISO,
} from "@/lib/content";
import { daysUntil } from "@/lib/format";
import Ticker from "@/components/chrome/Ticker";
import SignalField from "@/components/home/SignalField";
import EnforcementClock from "@/components/chrome/EnforcementClock";
import Reveal from "@/components/Reveal";
import { LeadCard, IndexCard, RowCard } from "@/components/ArticleCard";
import { PlusBadge } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default function Home() {
  const featured = featuredArticles();
  const lead = featured[0];
  const secondary = featured.slice(1, 4);
  const latest = allArticles().slice(0, 6);
  const teaserPrompts = allPrompts()
    .filter((p) => !p.premium)
    .slice(0, 2)
    .concat(allPrompts().filter((p) => p.premium).slice(0, 1));
  const founding = foundingStatus();
  const earlyBirdDays = daysUntil(EARLY_BIRD_END_ISO);

  return (
    <>
      {/* ——— Hero: the desk ——— */}
      <section className="relative overflow-hidden border-b rule">
        <SignalField />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-14 sm:px-6 lg:grid-cols-[1.5fr_1fr] lg:gap-16 lg:pb-20 lg:pt-20">
          <div>
            <p className="f-label" style={{ color: "var(--ink-muted)" }}>
              STAI — Signal &amp; Training for Audit Intelligence
            </p>
            <h1 className="f-display mt-5 text-[clamp(2.6rem,7vw,5.2rem)] text-cream-100">
              AI is rewriting the audit.
              <br />
              <span className="text-cream-400">Stay the one who checks.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              The intelligence desk for audit, accountancy and finance professionals across Europe — sharp
              editorial, audit-grade prompts, and answers grounded in cited evidence. Built the way you work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/briefing" className="btn btn-primary">
                Read the Briefing
              </Link>
              <Link href="/assessment" className="btn btn-ghost">
                Run the AI-readiness assessment
              </Link>
            </div>
          </div>

          {/* Desk panel — self-start so it hugs its content instead of
              stretching to the hero row and leaving a void beneath. */}
          <div className="self-start border bg-navy-950/80 p-5 backdrop-blur-[2px] panel-lift rule-strong">
            <div className="flex items-center justify-between border-b pb-3 rule">
              <span className="f-label" style={{ color: "var(--ink-faint)" }}>
                Desk status
              </span>
              <span className="f-mono inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-cream-400">
                <span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-signal-up)" }} aria-hidden />
                Live
              </span>
            </div>
            <div className="border-b py-4 rule">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                EU AI Act — obligations enforceable
              </p>
              <p className="f-mono mt-2 text-2xl font-bold tabular-nums text-cream-100">
                <EnforcementClock compact />
              </p>
              <p className="f-mono mt-1 text-[0.65rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
                02 AUG 2026 · Art. 113 · deployer duties apply
              </p>
            </div>
            <div className="border-b py-4 rule">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                This week on the desk
              </p>
              <ul className="mt-2 space-y-2">
                {latest.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/briefing/${a.slug}`}
                      className="block text-sm leading-snug text-cream-200 hover:text-cream-100"
                    >
                      <span className="f-mono mr-2 text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                        ▸
                      </span>
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-4">
              <p className="f-mono text-[0.68rem] leading-relaxed tracking-[0.02em]" style={{ color: "var(--ink-muted)" }}>
                <span className="text-cream-100">{founding.remaining}</span> of 200 founding-member seats
                remain · €12/mo locked forever ·{" "}
                <Link href="/plus" className="underline underline-offset-2 hover:text-cream-100">
                  claim yours
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Ticker />

      {/* ——— Front page ——— */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-baseline justify-between border-b pb-3 rule-strong">
          <h2 className="f-display text-2xl text-cream-100">The Briefing</h2>
          <Link href="/briefing" className="f-label text-cream-400 hover:text-cream-100">
            Full desk →
          </Link>
        </div>

        <div className="mt-8 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {lead && <LeadCard a={lead} />}
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {secondary.map((a, i) => (
                <Reveal key={a.id} delay={i * 80}>
                  <IndexCard a={a} num={String(i + 2).padStart(2, "0")} />
                </Reveal>
              ))}
            </div>
          </div>
          <aside className="lg:border-l lg:pl-8 rule">
            <h3 className="f-label" style={{ color: "var(--ink-faint)" }}>
              Latest on the wire
            </h3>
            <div className="mt-2">
              {latest.map((a) => (
                <RowCard key={a.id} a={a} />
              ))}
            </div>
            <Link href="/briefing" className="f-label mt-4 inline-block text-cream-400 hover:text-cream-100">
              Open the Radar view →
            </Link>
          </aside>
        </div>
      </section>

      {/* ——— Ask STAI teaser ——— */}
      <section className="border-y bg-navy-850 rule">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                Ask STAI
              </p>
              <h2 className="f-display mt-3 text-3xl text-cream-100 sm:text-4xl">
                Answers with an evidence trail
              </h2>
              <p className="mt-4 max-w-md leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                Ask STAI answers from the platform&apos;s own research and reporting — every claim cited, every
                citation one click from its source. If the desk hasn&apos;t covered it, it says so. No confident
                inventions, ever. Export any answer as a working-paper memo.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/ask" className="btn btn-primary">
                  Ask a question
                </Link>
                <span className="f-mono self-center text-[0.68rem] tracking-[0.08em]" style={{ color: "var(--ink-faint)" }}>
                  Free taste · unlimited on <PlusBadge />
                </span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="border bg-navy-950 p-5 rule-strong" aria-label="Example Ask STAI exchange">
              <p className="f-mono text-[0.7rem] tracking-[0.06em] text-cream-400">
                <span style={{ color: "var(--ink-faint)" }}>you ›</span> Do we need to keep the prompts our team
                used on an engagement?
              </p>
              <div className="f-mono mt-4 space-y-3 border-t pt-4 text-[0.78rem] leading-relaxed rule text-cream-200">
                <p>
                  Yes — if an AI output influenced an audit conclusion, the prompt is audit documentation under
                  ISA 230: it is the procedure design, and reperformance is impossible without it{" "}
                  <span className="text-cream-400">[1]</span>. Inspection teams in two jurisdictions already
                  request the full chain — prompt, model version, data scope, corroboration{" "}
                  <span className="text-cream-400">[1]</span>. The emerging practice is a single AI-procedures
                  memo per engagement recording tools, populations and human review{" "}
                  <span className="text-cream-400">[2]</span>.
                </p>
                <p className="text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                  [1] The prompt is the new working paper — M. van Dijk · [2] What CSRD assurance teams actually
                  need from AI — S. Lindqvist
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ——— Prompt library teaser ——— */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-3 rule-strong">
          <div>
            <h2 className="f-display text-2xl text-cream-100">The Prompt Library</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              Vetted, guardrailed prompts for real audit, tax and finance work — written like methodology, not
              magic tricks.
            </p>
          </div>
          <Link href="/prompts" className="f-label text-cream-400 hover:text-cream-100">
            Browse all →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {teaserPrompts.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <Link
                href={`/prompts/${p.slug}`}
                className="group flex h-full flex-col border bg-navy-850 p-5 transition-colors rule hover:border-[var(--line-strong)]"
              >
                <div className="flex items-center justify-between">
                  <span className="f-mono text-[0.62rem] tracking-[0.16em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {p.category}
                  </span>
                  {p.premium ? (
                    <PlusBadge />
                  ) : (
                    <span className="f-mono text-[0.62rem] tracking-[0.14em] uppercase text-cream-400">Free</span>
                  )}
                </div>
                <h3 className="f-display-wide mt-3 text-lg text-cream-100">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                  {p.description}
                </p>
                <p className="f-mono mt-4 text-[0.65rem] tracking-[0.08em]" style={{ color: "var(--ink-faint)" }}>
                  {p.uses > 0 ? `${p.uses} uses this quarter · ` : ""}open →
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="mt-6 border p-5 rule" style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.04)" }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-2xl text-sm leading-relaxed text-cream-200">
                <span className="f-mono mr-2 text-[0.65rem] font-bold tracking-[0.16em] uppercase text-gold-300">
                  Adapt with AI
                </span>
                STAI+ members hand any prompt their client, sector, jurisdiction and framework — and get it
                rewritten for that exact engagement, guardrails intact, with a note on what changed and why.
              </p>
              <Link href="/plus" className="btn btn-plus-ghost premium-focus">
                See STAI+
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ——— Assessment band (cream) ——— */}
      <section className="border-y bg-cream-200 rule">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <p className="f-mono text-[0.65rem] font-semibold tracking-[0.18em] uppercase text-navy-700">
              Free diagnostic · 3 minutes
            </p>
            <h2 className="f-display mt-2 text-3xl text-navy-900 sm:text-4xl">
              Where does your firm actually stand?
            </h2>
            <p className="mt-3 text-navy-800">
              Eight questions calibrated against how European firms are really deploying AI. Get your maturity
              band, the gaps inspectors would find first, and the next three moves — scored instantly.
            </p>
          </div>
          <Link
            href="/assessment"
            className="btn border-navy-900 bg-navy-900 text-cream-100 hover:bg-navy-800"
          >
            Take the assessment
          </Link>
        </div>
      </section>

      {/* ——— Training strip ——— */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-3 rule-strong">
          <div>
            <h2 className="f-display text-2xl text-cream-100">Training for firms</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              Live programmes that turn licences into practice — early-bird pricing ends in {earlyBirdDays} days.
            </p>
          </div>
          <Link href="/training" className="f-label text-cream-400 hover:text-cream-100">
            Programmes &amp; booking →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { name: "Copilot Beginners", price: "€1,195", note: "Half-day · foundations & scenario drills" },
            { name: "Copilot Experienced", price: "€2,245", note: "Full day · most popular", popular: true },
            { name: "Full AI Package", price: "€5,625", note: "Multi-week · firm-wide transformation" },
          ].map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <Link
                href="/training"
                className="group block border p-5 transition-colors rule hover:border-[var(--line-strong)]"
              >
                <div className="flex items-center justify-between">
                  <span className="index-num">{String(i + 1).padStart(2, "0")}</span>
                  {t.popular && (
                    <span className="f-mono text-[0.62rem] font-bold tracking-[0.16em] uppercase text-cream-100">
                      Most booked
                    </span>
                  )}
                </div>
                <h3 className="f-display-wide mt-3 text-xl text-cream-100">{t.name}</h3>
                <p className="f-mono mt-2 text-lg font-bold tabular-nums text-cream-100">
                  {t.price}
                  <span className="ml-2 text-[0.65rem] font-medium" style={{ color: "var(--ink-faint)" }}>
                    −25% early bird
                  </span>
                </p>
                <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                  {t.note}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ——— Founding member band (gold — premium) ——— */}
      <section className="border-t rule" style={{ background: "linear-gradient(180deg, rgba(201,168,76,0.07), rgba(201,168,76,0.02))" }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <p className="f-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-gold-300">
              Founding membership — {founding.remaining} of {founding.total} seats left
            </p>
            <h2 className="f-display mt-2 text-3xl text-cream-100 sm:text-4xl">
              €12 a month. Locked forever.
            </h2>
            <p className="mt-3 max-w-xl" style={{ color: "var(--ink-muted)" }}>
              The first 200 members keep founding pricing for the life of their subscription — full prompt
              library, adapt-with-AI, unlimited Ask STAI, saved briefings. When the counter hits zero, it&apos;s
              €19.
            </p>
          </div>
          <Link href="/plus" className="btn btn-plus premium-focus">
            Become a founding member
          </Link>
        </div>
      </section>
    </>
  );
}
