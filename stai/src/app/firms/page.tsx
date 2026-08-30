import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { FIRM_INTERESTS } from "@/lib/firms";
import { PROGRAMMES } from "@/lib/training";
import { EARLY_BIRD_END_ISO } from "@/lib/content";
import { daysUntil } from "@/lib/format";
import EnforcementClock from "@/components/chrome/EnforcementClock";
import FirmEnquiryForm from "@/components/firms/FirmEnquiryForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "STAI for firms — AI capability, governance and evidence",
  description:
    "Firm-wide AI capability for European audit and accountancy practices: live training, adoption evidence for your quality file, an AI Act compliance workspace and accredited CPD. Talk to the founders.",
  path: "/firms",
});

const eur = (n: number) => `€${n.toLocaleString("en-IE")}`;

export default function FirmsPage() {
  const days = daysUntil(EARLY_BIRD_END_ISO);
  const available = FIRM_INTERESTS.filter((i) => i.available);
  const building = FIRM_INTERESTS.filter((i) => !i.available);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <JsonLd
        data={breadcrumbSchema([
          { name: "STAI", path: "/" },
          { name: "For firms", path: "/firms" },
        ])}
      />

      {/* ——— Hero ——— */}
      <header className="max-w-3xl">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          For firms
        </p>
        <h1 className="f-display mt-2 text-[clamp(2.4rem,6vw,4.6rem)] text-cream-100">
          Your people already use AI.
          <br />
          <span className="text-cream-400">Can you evidence it?</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          From 2 August 2026 the question stops being whether your firm uses AI and becomes whether you can
          show a supervisor how, by whom, under what controls. The AFM is already asking firms to reconcile
          licensed seats against documented use. Most firms cannot.
        </p>
        <p className="f-mono mt-5 inline-flex items-center gap-3 border px-3 py-2 text-[0.7rem] rule-strong">
          <EnforcementClock />
        </p>
      </header>

      {/* ——— The three gaps ——— */}
      <section className="mt-14">
        <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
          What firms come to us with
        </h2>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          {[
            {
              n: "01",
              h: "Adoption without evidence",
              p: "Licences bought, usage unknown. Your quality function can't answer what was used on which engagement, and ISQM 1 says that's their job. The gap between seats and documented use is the first thing an inspector will size.",
            },
            {
              n: "02",
              h: "Training that didn't take",
              p: "Our field data: firms running feature tours reach 34% weekly active use. Firms running scenario-based training reach 78%. The variable isn't the tool or the people — it's whether the training was built around the work.",
            },
            {
              n: "03",
              h: "Deadline with no artefacts",
              p: "The Act requires a use-register, per-system classification, Article 26 deployer controls and Article 4 literacy evidence. Firms know this. Very few have the documents, and August is not moving.",
            },
          ].map((c) => (
            <article key={c.n}>
              <span className="index-num">{c.n}</span>
              <h3 className="f-display-wide mt-3 text-xl text-cream-100">{c.h}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                {c.p}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ——— Available now ——— */}
      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-3 rule-strong">
          <div>
            <h2 className="f-display text-2xl text-cream-100">Available now</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              What we can deliver to your firm today.
            </p>
          </div>
          <span className="f-mono text-[0.65rem] tracking-[0.12em] uppercase" style={{ color: "var(--color-signal-up)" }}>
            ● Shipping
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="border p-6 rule-strong">
            <h3 className="f-display text-2xl text-cream-100">Live training programmes</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              {available[0]?.blurb}
            </p>
            <ul className="mt-5 space-y-3">
              {PROGRAMMES.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 rule">
                  <span className="text-cream-100">
                    {p.name}
                    {p.popular && (
                      <span className="f-mono ml-3 text-[0.58rem] tracking-[0.14em] uppercase text-cream-400">
                        Most booked
                      </span>
                    )}
                  </span>
                  <span className="f-mono text-sm tabular-nums text-cream-100">
                    {eur(p.earlyBird)}
                    <span className="ml-2 text-[0.62rem] line-through" style={{ color: "var(--ink-faint)" }}>
                      {eur(p.list)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="f-mono mt-4 text-[0.65rem] tracking-[0.08em] uppercase" style={{ color: "var(--ink-faint)" }}>
              25% early bird · {days} days left · attendance &amp; competence records for your ISQM 1 file
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/training" className="btn btn-primary">
                Programme detail
              </Link>
              <a href="#talk" className="btn btn-ghost">
                Talk to us
              </a>
            </div>
          </div>

          <div className="border p-6 rule">
            <h3 className="f-display-wide text-xl text-cream-100">Start with the diagnostic</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              Eight questions across governance, people, practice and evidence. You get your maturity band, the
              dimension an inspector would probe first, and your next three moves — and, once enough firms have
              taken part, where you sit against comparable European practices.
            </p>
            <p className="f-mono mt-4 text-[0.65rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
              Free · ~3 minutes · no account needed
            </p>
            <Link href="/assessment" className="btn btn-ghost mt-5">
              Run the assessment
            </Link>
          </div>
        </div>
      </section>

      {/* ——— In development ——— */}
      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-3 rule-strong">
          <div>
            <h2 className="f-display text-2xl text-cream-100">In development</h2>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
              Being built now, in this order, decided by what firms actually ask for. Tell us which of these you
              need and you shape the queue — and get it first.
            </p>
          </div>
          <span className="f-mono text-[0.65rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
            ○ Shaping
          </span>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {building.map((i, idx) => (
            <article key={i.id} className="flex flex-col border p-5 rule">
              <span className="index-num">{String(idx + 1).padStart(2, "0")}</span>
              <h3 className="f-display-wide mt-2 text-lg text-cream-100">{i.label}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                {i.blurb}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ——— Why us ——— */}
      <section className="mt-16 border p-6 rule sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <h2 className="f-display text-2xl text-cream-100 sm:text-3xl">Why bring us in</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                h: "We take no vendor money",
                p: "No tool pays us for coverage or placement, ever. When we tell your partners which tooling holds up, there is nothing behind the advice except the evidence.",
              },
              {
                h: "Built for your network posture",
                p: "The platform makes zero third-party calls at runtime — no CDN fonts, no external scripts, no analytics beacons. It works behind the strictest firm proxy, and your security team can verify that in an afternoon.",
              },
              {
                h: "Practitioners, not a content farm",
                p: "Our field research follows real firms through real deployments and publishes the numbers, including the unflattering ones. That's why quality leaders read us.",
              },
              {
                h: "Everything lands in the file",
                p: "Training produces competence records. Prompts carry their guardrails. Assistant answers export as working papers with citations. Documentation isn't an afterthought here — it's the design brief.",
              },
            ].map((b) => (
              <div key={b.h}>
                <h3 className="f-display-wide text-base text-cream-100">{b.h}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {b.p}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Enquiry ——— */}
      <section id="talk" className="mt-16 scroll-mt-28">
        <div className="border-b pb-3 rule-strong">
          <h2 className="f-display text-2xl text-cream-100">Talk to the founders</h2>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
            Tell us where your firm is and what you need. What you pick below genuinely decides what we build
            next — we&apos;d rather build the thing forty firms asked for than the thing we guessed at.
          </p>
        </div>
        <div className="mt-8 max-w-3xl">
          <FirmEnquiryForm />
        </div>
      </section>
    </div>
  );
}
