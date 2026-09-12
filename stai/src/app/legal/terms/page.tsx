import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms of use",
  description: "STAI terms: not professional advice, personal subscriptions, founding pricing honoured for life, cancel anytime.",
  path: "/legal/terms",
});

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Legal
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100">Terms of use</h1>
      <div className="prose-stai mt-8">
        <p>The terms that actually matter, stated the way we&apos;d want them stated to us:</p>
        <ul>
          <li>
            <strong>Not professional advice.</strong> STAI is intelligence and tooling for professionals. Every
            output — briefings, prompts, assistant answers, assessments — requires your professional judgement
            before reliance. Engagement responsibility stays with the engagement.
          </li>
          <li>
            <strong>Your subscription is personal.</strong> One member, one login. Firm-wide access is licensed
            separately — ask the training desk.
          </li>
          <li>
            <strong>Founding pricing is honoured for life.</strong> €12/month for as long as your subscription
            remains active. Lapse and rejoin, and the then-current pricing applies — the lock is the loyalty.
          </li>
          <li>
            <strong>Prompts are yours to use</strong> in your practice, including adapted versions. They are not
            yours to republish as a competing library.
          </li>
          <li>
            <strong>Cancel anytime.</strong> Monthly plans end at the period close; annual plans run their term.
          </li>
        </ul>
        <p>Governing law: the Netherlands. The full contractual terms ship with the production release.</p>
      </div>
    </div>
  );
}
