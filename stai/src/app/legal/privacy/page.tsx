import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Legal
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100">Privacy</h1>
      <div className="prose-stai mt-8">
        <p>
          The short version, in the plain language we&apos;d demand from anyone else: we collect what the service
          needs and nothing else — your account details, what you save, your subscription state, and the
          questions you ask the assistant (to enforce quotas and improve retrieval).
        </p>
        <ul>
          <li>We do not sell data, full stop.</li>
          <li>Ask STAI questions and adapted-prompt context are processed by our AI provider under a no-training agreement; nothing you type becomes anyone&apos;s model.</li>
          <li>All data is stored in the EU. Payment details never touch our servers — they go directly to Stripe.</li>
          <li>Delete your account and your data goes with it, immediately, including bookmarks and saved answers.</li>
          <li>The newsletter is one-click unsubscribe, and we don&apos;t track opens with hidden pixels.</li>
        </ul>
        <p>
          Questions, access requests, deletions: desk@stai.ai. This page is a working summary; the full GDPR
          notice ships with the production release and will be linked here.
        </p>
      </div>
    </div>
  );
}
