import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { foundingStatus } from "@/lib/content";
import { currentUser } from "@/lib/auth";
import { SPlusMark } from "@/components/Logo";
import CheckoutButton from "@/components/plus/CheckoutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "STAI+ membership",
  description: "The full prompt library with adapt-with-AI, unlimited Ask STAI, every briefing and saved content. €19/month, €149/year, or €12/month locked forever as a founding member.",
  path: "/plus",
});

const FEATURES: { label: string; free: string; plus: string }[] = [
  { label: "The Briefing", free: "Most pieces", plus: "Every piece, including member briefings" },
  { label: "Prompt library", free: "Open slice (8 prompts)", plus: "Full canon — every prompt, every category" },
  { label: "Adapt with AI", free: "—", plus: "Any prompt rewritten for your exact engagement" },
  { label: "Ask STAI", free: "5 questions / month", plus: "Unlimited, with saved answers" },
  { label: "Working-paper export", free: "Ask STAI answers", plus: "Answers + adapted prompts" },
  { label: "Saved to your desk", free: "—", plus: "Bookmark briefings, prompts and answers" },
  { label: "The STAI Brief", free: "Every Tuesday", plus: "Every Tuesday" },
  { label: "AI-readiness assessment", free: "Included", plus: "Included" },
];

export default async function PlusPage() {
  const founding = foundingStatus();
  const user = await currentUser();
  const isPlus = user?.plan === "plus";
  const pct = Math.round((founding.claimed / founding.total) * 100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <div className="flex items-center gap-3">
          <SPlusMark size={34} />
          <p className="f-mono text-[0.7rem] font-bold tracking-[0.2em] uppercase text-gold-300">
            STAI+ membership
          </p>
        </div>
        <h1 className="f-display mt-4 text-4xl text-cream-100 sm:text-6xl">
          The whole desk. <span className="text-gold-300">Working for you.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Everything free members read, plus the tools that do work: the complete prompt canon, AI adaptation to
          your exact engagement, unlimited grounded answers, and a desk that remembers what you saved.
        </p>
      </header>

      {isPlus ? (
        <div className="mt-10 border p-6" style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.05)" }}>
          <p className="f-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase text-gold-300">
            You&apos;re a member{user?.founding ? " — founding rate locked" : ""}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            Manage your subscription from{" "}
            <Link href="/account" className="text-cream-100 underline underline-offset-4">
              your account
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {/* founding banner — live scarcity */}
          {founding.remaining > 0 && (
            <section
              className="mt-10 border p-6 sm:p-8"
              style={{ borderColor: "var(--gold-line)", background: "linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.03))" }}
              aria-label="Founding member offer"
            >
              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
                <div>
                  <p className="f-mono text-[0.68rem] font-bold tracking-[0.18em] uppercase text-gold-300">
                    Founding membership — closes at 200 members, no extensions
                  </p>
                  <p className="f-display mt-3 text-3xl text-cream-100 sm:text-4xl">
                    €12/month. Locked for the life of your subscription.
                  </p>
                  <div className="mt-5 max-w-md">
                    <div className="flex justify-between">
                      <span className="f-mono text-[0.65rem] tracking-[0.1em] uppercase text-gold-300">
                        {founding.claimed} claimed
                      </span>
                      <span className="f-mono text-[0.65rem] tracking-[0.1em] uppercase text-cream-400">
                        {founding.remaining} remain
                      </span>
                    </div>
                    <div className="mt-1.5 h-[8px] w-full border" style={{ borderColor: "var(--gold-line)" }} role="img" aria-label={`${founding.claimed} of ${founding.total} founding seats claimed`}>
                      <div className="h-full bg-gold-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div>
                  <CheckoutButton plan="founding" label={`Claim seat ${founding.claimed + 1} of ${founding.total}`} />
                  <p className="f-mono mt-2 text-center text-[0.62rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
                    Cancel anytime · the rate never rises while you stay
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* standard plans */}
          <section className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="border p-6 rule">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                Monthly
              </p>
              <p className="mt-2">
                <span className="f-mono text-4xl font-bold text-cream-100">€19</span>
                <span className="f-mono ml-2 text-sm" style={{ color: "var(--ink-faint)" }}>
                  / month
                </span>
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                Cancel anytime.
              </p>
              <div className="mt-5">
                <CheckoutButton plan="monthly" label="Start monthly" variant="plus-ghost" />
              </div>
            </div>
            <div className="border p-6 rule">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                Annual
              </p>
              <p className="mt-2">
                <span className="f-mono text-4xl font-bold text-cream-100">€149</span>
                <span className="f-mono ml-2 text-sm" style={{ color: "var(--ink-faint)" }}>
                  / year — two months free
                </span>
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                €12.42/month, billed yearly.
              </p>
              <div className="mt-5">
                <CheckoutButton plan="annual" label="Start annual" variant="plus-ghost" />
              </div>
            </div>
          </section>
        </>
      )}

      {/* comparison */}
      <section className="mt-14">
        <h2 className="f-display border-b pb-3 text-2xl text-cream-100 rule-strong">What opens up</h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[36rem] border-collapse">
            <thead>
              <tr>
                <th className="f-label w-1/3 py-3 text-left" style={{ color: "var(--ink-faint)" }}>
                  Capability
                </th>
                <th className="f-label w-1/3 py-3 text-left" style={{ color: "var(--ink-faint)" }}>
                  Free
                </th>
                <th className="f-label w-1/3 py-3 text-left text-gold-300">STAI+</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.label} className="border-t rule">
                  <td className="py-3.5 pr-4 text-sm font-medium text-cream-100">{f.label}</td>
                  <td className="py-3.5 pr-4 text-sm" style={{ color: "var(--ink-muted)" }}>
                    {f.free}
                  </td>
                  <td className="py-3.5 text-sm text-cream-200">{f.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* the pitch, honestly */}
      <section className="mt-14 grid gap-8 border p-6 rule sm:p-8 lg:grid-cols-3">
        {[
          {
            h: "Costs less than the hour it saves",
            p: "One adapted prompt that lands — a risk brainstorm, an estimate challenge, a TCWG letter — pays for the month. Members average eleven prompt uses a month.",
          },
          {
            h: "Answers you can file",
            p: "Ask STAI cites its sources and exports working-paper memos. It's the difference between 'the AI said so' and documentation a reviewer can trace.",
          },
          {
            h: "Priced for individuals, honest for firms",
            p: "STAI+ is a personal professional subscription. Rolling it out to a team? That's what the training programmes and firm plans are for — talk to us.",
          },
        ].map((b) => (
          <div key={b.h}>
            <h3 className="f-display-wide text-lg text-cream-100">{b.h}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              {b.p}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
