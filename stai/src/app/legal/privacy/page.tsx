import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Privacy",
  description:
    "What STAI collects, why, and who else receives it. No trackers, no advertising, no third-party analytics.",
  path: "/legal/privacy",
});

/**
 * This page must describe what the deployed system ACTUALLY does.
 *
 * The previous version promised EU-only storage, an AI no-training agreement
 * and one-click newsletter unsubscribe — none of which were true of the
 * running software. For a publication read by auditors, an inaccurate privacy
 * notice is worse than a sparse one.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Legal
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100">Privacy</h1>
      <div className="prose-stai mt-8">
        <p>
          STAI is currently free, and there is no payment processing, no advertising and no third-party
          analytics on this site. What follows describes the software as it actually runs today, not what we
          intend to build.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>If you create an account:</strong> your email address, your name, and your firm if you give
            one. Your password is stored only as a bcrypt hash — we cannot read it.
          </li>
          <li>
            <strong>A session cookie</strong> so you stay signed in. It holds a random token, nothing about you.
          </li>
          <li>
            <strong>What you save:</strong> bookmarked briefings and prompts, and any Ask STAI answers you
            explicitly choose to save.
          </li>
          <li>
            <strong>If you join a waitlist:</strong> the email address you enter, plus any optional firm, role
            and interest answers you choose to give.
          </li>
          <li>
            <strong>If you run the AI-readiness assessment:</strong> your answers and score, plus firm details
            only if you submit them.
          </li>
          <li>
            <strong>Aggregate usage counts</strong> — which pages and articles are viewed, and how often
            features are used. These are stored on our own server, counted against a random session identifier
            held in a cookie for the browsing session. We do not fingerprint devices, do not build profiles,
            and do not link these counts to your account.
          </li>
        </ul>

        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell or share data with advertisers or data brokers. There are none involved.</li>
          <li>
            We do not store the questions you type into Ask STAI. The service counts how many questions you
            have asked — to enforce the free quota — and nothing more.
          </li>
          <li>We run no third-party analytics, no advertising pixels, and no social tracking scripts.</li>
          <li>We do not track email opens with hidden pixels.</li>
        </ul>

        <h2>Who else receives your data</h2>
        <p>
          Only the parties genuinely involved in running the service. As deployed today that is our hosting
          provider, which stores the database and serves the site.
        </p>
        <p>
          If and when the AI assistant is connected to a language-model provider, the text of your question and
          extracts from STAI&apos;s own published articles are sent to that provider to compose an answer. Your
          name, email and account details are not. We will name the provider here before that is switched on.
          When paid membership opens, a payment provider will handle card details directly — those will never
          reach our servers — and we will name them here at that point too.
        </p>

        <h2>Your rights</h2>
        <p>
          You can see everything we hold about you on{" "}
          <Link href="/account">your account page</Link>, and delete your account and its data from there
          immediately — bookmarks, saved answers and waitlist entries included. You can also ask us to access,
          correct or erase your data, or object to processing, by writing to the address below. Under the GDPR
          you may complain to your national supervisory authority.
        </p>

        <h2>How long we keep things</h2>
        <p>
          Account data lasts until you delete your account. Sessions expire after 30 days. Aggregate usage
          counts are retained for 12 months. Waitlist entries are kept until the waitlist closes or you ask us
          to remove yours.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy questions, access requests and deletions: <strong>desk@stai.ai</strong>.
        </p>
      </div>
    </div>
  );
}
