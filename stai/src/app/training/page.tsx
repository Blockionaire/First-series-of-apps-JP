import type { Metadata } from "next";
import { PROGRAMMES } from "@/lib/training";
import { EARLY_BIRD_END_ISO } from "@/lib/content";
import { daysUntil } from "@/lib/format";
import EnquiryForm from "@/components/training/EnquiryForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training for firms",
  description:
    "Live AI training programmes for audit and accountancy firms — Copilot Beginners, Copilot Experienced, and the Full AI Package. 25% early-bird until 31 August 2026.",
};

const eur = (n: number) => `€${n.toLocaleString("en-IE")}`;

export default function TrainingPage() {
  const days = daysUntil(EARLY_BIRD_END_ISO);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-3xl">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Practice / training
        </p>
        <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">
          Licences are easy. Practice is trained.
        </h1>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Our field data is blunt: firms that train on <em>scenarios</em> reach 78% weekly active use; firms that
          run feature tours reach 34%. These programmes are the scenario kind — built by practitioners, run live
          in your firm, documented so your quality function can stand behind every workflow.
        </p>
        <p className="f-mono mt-5 inline-block border px-3 py-2 text-[0.7rem] tracking-[0.1em] uppercase rule-strong text-cream-100">
          25% early-bird on all programmes — ends 31 AUG 2026 · {days} days left
        </p>
      </header>

      {/* programmes */}
      <div className="grid gap-6 lg:grid-cols-3">
        {PROGRAMMES.map((p, i) => (
          <article
            key={p.id}
            className={`flex flex-col border p-6 ${p.popular ? "rule-strong bg-navy-850" : "rule"}`}
          >
            <div className="flex items-center justify-between">
              <span className="index-num">{String(i + 1).padStart(2, "0")}</span>
              {p.popular && (
                <span className="f-mono border px-2 py-0.5 text-[0.6rem] font-bold tracking-[0.16em] uppercase rule-strong text-cream-100">
                  Most booked
                </span>
              )}
            </div>
            <h2 className="f-display mt-4 text-2xl text-cream-100">{p.name}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              {p.tagline}
            </p>

            <p className="mt-5">
              <span className="f-mono text-3xl font-bold tabular-nums text-cream-100">{eur(p.earlyBird)}</span>
              <span className="f-mono ml-3 text-sm line-through" style={{ color: "var(--ink-faint)" }}>
                {eur(p.list)}
              </span>
              <span className="f-mono ml-2 text-[0.65rem] tracking-[0.1em] uppercase text-cream-400">
                early bird
              </span>
            </p>
            <p className="f-mono mt-2 text-[0.65rem] leading-relaxed tracking-[0.04em]" style={{ color: "var(--ink-faint)" }}>
              {p.format}
            </p>

            <div className="mt-5 border-t pt-4 rule">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                Built for
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                {p.audience}
              </p>
            </div>

            <div className="mt-4">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                You leave with
              </p>
              <ul className="mt-2 space-y-2">
                {p.outcomes.map((o) => (
                  <li key={o} className="flex gap-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    <span className="shrink-0 text-cream-400" aria-hidden>
                      —
                    </span>
                    {o}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex-1">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                Modules
              </p>
              <ul className="f-mono mt-2 space-y-1.5 text-[0.72rem] leading-relaxed text-cream-400">
                {p.modules.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>

            <a href="#enquire" className={`btn mt-6 ${p.popular ? "btn-primary" : "btn-ghost"}`}>
              Enquire about {p.name.split(" ")[p.name.split(" ").length - 1]}
            </a>
          </article>
        ))}
      </div>

      {/* the deadline argument */}
      <section className="mt-14 border p-6 rule sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <h2 className="f-display text-2xl text-cream-100 sm:text-3xl">
            Why firms are booking autumn cohorts now
          </h2>
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            <p>
              On <span className="text-cream-100">2 August 2026</span> the EU AI Act&apos;s deployer obligations
              become enforceable — including demonstrable staff competence for AI-assisted work (Art. 4 AI
              literacy). Supervisors have started joining the dots: the AFM&apos;s thematic review explicitly asks
              firms to reconcile licensed seats against evidenced, documented use.
            </p>
            <p>
              Training is the artefact that closes that gap. Every programme ships with an attendance and
              competence record formatted for your ISQM 1 file — so the training is not just adoption, it&apos;s
              evidence.
            </p>
          </div>
        </div>
      </section>

      {/* enquiry */}
      <section id="enquire" className="mt-14 scroll-mt-28">
        <div className="border-b pb-3 rule-strong">
          <h2 className="f-display text-2xl text-cream-100">Enquire &amp; book</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Tell us where your teams are; we&apos;ll come back within one working day with dates and a proposal.
          </p>
        </div>
        <div className="mt-6 max-w-3xl">
          <EnquiryForm />
        </div>
      </section>
    </div>
  );
}
