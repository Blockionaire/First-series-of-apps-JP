import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta, abs, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import EnforcementClock from "@/components/chrome/EnforcementClock";
import { DEPLOYER_OBLIGATIONS, ARTEFACTS, MILESTONES, PENALTIES } from "@/lib/aiact";
import { allArticles } from "@/lib/content";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "The EU AI Act for audit firms — what changes on 2 August 2026",
  description:
    "A practitioner's tracker for the EU AI Act's 2 August 2026 enforcement date: what applies to audit and accountancy firms, the Article 26 deployer duties in plain terms, the six artefacts you need, penalties, and the full application timeline.",
  path: "/ai-act",
});

export default function AiActPage() {
  const related = allArticles()
    .filter((a) => a.tags.some((t) => /AI Act|supervision|ISQM|deployer/i.test(t)) || a.category === "Regulation")
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "STAI", path: "/" },
            { name: "EU AI Act tracker", path: "/ai-act" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Does the EU AI Act apply to audit firms?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. An audit firm becomes a deployer under Article 3(4) the moment staff run an AI system in the course of their work, inheriting Article 26 deployer obligations for high-risk uses and the Article 4 AI-literacy duty for all AI use. Firms can also become providers under Article 25 if they substantially modify or fine-tune a system.",
                },
              },
              {
                "@type": "Question",
                name: "What happens on 2 August 2026?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "The main body of the Act becomes applicable: high-risk obligations under Annex III, transparency duties under Article 50, and enforcement by national market-surveillance authorities with penalties up to 7% of global turnover for prohibited practices and 3% for most other breaches.",
                },
              },
              {
                "@type": "Question",
                name: "Is using Microsoft Copilot in an audit high-risk under the AI Act?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Most audit uses — summarising documents, drafting memos, chasing information requests — are not high-risk under Annex III. Two things pull firm tooling into scope: employment-related uses such as staff evaluation or scheduling, which sit in Annex III(4), and creditworthiness-adjacent analytics under Annex III(5)(b). Classification must be documented per system and revisited when use widens.",
                },
              },
            ],
          },
        ]}
      />

      {/* ——— Hero ——— */}
      <header className="border-b pb-8 rule">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Reference · updated continuously · free, always
        </p>
        <h1 className="f-display mt-3 text-[clamp(2.4rem,6.5vw,5rem)] text-cream-100">
          The EU AI Act
          <br />
          <span className="text-cream-400">hits the audit file</span>
        </h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <p className="max-w-2xl text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            On <strong className="text-cream-100">2 August 2026</strong> the Act&apos;s main body becomes
            applicable and national authorities can enforce it. This page is what a practitioner actually needs:
            what applies to your firm, the deployer duties in plain terms, and the documents to have ready.
            No vendor pitch, no gate.
          </p>
          <div className="border bg-navy-950 p-5 panel-lift rule-strong">
            <p className="f-label" style={{ color: "var(--ink-faint)" }}>
              Time to enforcement
            </p>
            <p className="f-mono mt-2 text-2xl font-bold text-cream-100">
              <EnforcementClock compact />
            </p>
            <p className="f-mono mt-1 text-[0.62rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
              02 AUG 2026 · Art. 113
            </p>
          </div>
        </div>
      </header>

      {/* ——— Does it apply ——— */}
      <section className="mt-14">
        <h2 className="f-display text-2xl text-cream-100 sm:text-3xl">Does this apply to your firm?</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            {
              q: "Do your people use AI at work?",
              a: "Then you are a deployer under Art. 3(4) and the Art. 4 AI-literacy duty already applies to you — it has since February 2025.",
              tone: "Almost certainly yes",
            },
            {
              q: "Does any AI touch hiring, evaluation or scheduling?",
              a: "That is Annex III(4) — high-risk. Firms scrutinise clients for this and routinely miss it in their own HR stack.",
              tone: "Check today",
            },
            {
              q: "Do you fine-tune or substantially modify a system?",
              a: "Art. 25 can move you from deployer to provider, inheriting conformity-assessment duties nobody has budgeted for.",
              tone: "The expensive surprise",
            },
          ].map((c) => (
            <article key={c.q} className="border p-5 rule">
              <p className="f-mono text-[0.6rem] font-bold tracking-[0.14em] uppercase text-cream-400">{c.tone}</p>
              <h3 className="f-display-wide mt-2 text-lg text-cream-100">{c.q}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                {c.a}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ——— Deployer obligations ——— */}
      <section className="mt-14">
        <h2 className="f-display text-2xl text-cream-100 sm:text-3xl">What you owe as a deployer</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Every duty cited so you can check us against the text.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className="f-label py-3 pr-4 text-left" style={{ color: "var(--ink-faint)" }}>
                  Article
                </th>
                <th className="f-label py-3 pr-4 text-left" style={{ color: "var(--ink-faint)" }}>
                  Duty
                </th>
                <th className="f-label py-3 pr-4 text-left" style={{ color: "var(--ink-faint)" }}>
                  What it means in a firm
                </th>
                <th className="f-label py-3 text-left" style={{ color: "var(--ink-faint)" }}>
                  Likely owner
                </th>
              </tr>
            </thead>
            <tbody>
              {DEPLOYER_OBLIGATIONS.map((o) => (
                <tr key={o.article} className="border-t rule align-top">
                  <td className="f-mono py-3.5 pr-4 whitespace-nowrap text-[0.72rem] text-cream-400">{o.article}</td>
                  <td className="py-3.5 pr-4 font-medium text-cream-100">{o.duty}</td>
                  <td className="py-3.5 pr-4 leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {o.meaning}
                  </td>
                  <td className="py-3.5 text-[0.82rem]" style={{ color: "var(--ink-muted)" }}>
                    {o.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ——— Artefacts ——— */}
      <section className="mt-14">
        <h2 className="f-display text-2xl text-cream-100 sm:text-3xl">The six documents to have ready</h2>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Firms in decent shape share these. None took more than a quarter to build.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ARTEFACTS.map((a, i) => (
            <article key={a.name} className="flex flex-col border p-5 rule">
              <span className="index-num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="f-display-wide mt-2 text-lg text-cream-100">{a.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                {a.why}
              </p>
              <p className="f-mono mt-3 text-[0.62rem] tracking-[0.04em]" style={{ color: "var(--ink-faint)" }}>
                {a.effort}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/assessment" className="btn btn-primary">
            Score your firm in 3 minutes
          </Link>
          <Link href="/prompts/ai-act-classification-memo" className="btn btn-ghost">
            Free classification-memo prompt
          </Link>
        </div>
      </section>

      {/* ——— Timeline ——— */}
      <section className="mt-14">
        <h2 className="f-display text-2xl text-cream-100 sm:text-3xl">The application timeline</h2>
        <ol className="mt-6">
          {MILESTONES.map((m) => (
            <li key={m.iso} className="grid gap-x-6 gap-y-1 border-t py-5 rule sm:grid-cols-[8rem_1fr]">
              <div>
                <p
                  className="f-mono text-[0.72rem] font-bold tracking-[0.08em] tabular-nums"
                  style={{ color: m.past ? "var(--ink-faint)" : "var(--color-cream-100)" }}
                >
                  {m.date}
                </p>
                <p className="f-mono text-[0.58rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
                  {m.past ? "In force" : "Ahead"}
                </p>
              </div>
              <div>
                <h3 className={`f-display-wide text-lg ${m.past ? "text-cream-400" : "text-cream-100"}`}>
                  {m.label}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {m.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ——— Penalties ——— */}
      <section className="mt-14">
        <h2 className="f-display text-2xl text-cream-100 sm:text-3xl">What non-compliance costs</h2>
        <ul className="mt-5">
          {PENALTIES.map((p) => (
            <li key={p.breach} className="flex flex-wrap items-baseline justify-between gap-3 border-t py-4 rule">
              <span className="text-cream-200">{p.breach}</span>
              <span className="f-mono text-sm text-cream-100">{p.cap}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Enforcement will start with model providers and conspicuous high-risk deployers, not mid-tier audit
          firms. But professional regulators move on a different axis: firm-level AI governance is already being
          read through ISQM 1, and there the exposure is immediate.
        </p>
      </section>

      {/* ——— Related ——— */}
      <section className="mt-14">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Go deeper
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {related.map((a) => (
            <li key={a.id}>
              <Link href={`/briefing/${a.slug}`} className="group block border p-4 rule hover:border-[var(--line-strong)]">
                <span className="f-mono text-[0.6rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
                  {a.category} · <time dateTime={a.published_at}>{fmtDate(a.published_at)}</time>
                </span>
                <span className="f-display-wide mt-1.5 block text-base text-cream-100 group-hover:text-white">
                  {a.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-14 border-t pt-6 rule">
        <p className="f-mono text-[0.65rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
          MAINTAINED BY STAI — {abs("/ai-act")} · Free to read, quote and link. This page structures the
          analysis; it is not legal advice, and classification of a specific system needs legal review.
        </p>
      </footer>
    </div>
  );
}
