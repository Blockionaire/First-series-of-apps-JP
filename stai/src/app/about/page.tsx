import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";

export const metadata: Metadata = pageMeta({
  title: "About STAI",
  description: "Why STAI exists: independent AI intelligence for European audit, accountancy and finance professionals. Evidence first, practice over hype, no vendor money.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        About
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-5xl">
        Signal &amp; training for audit intelligence
      </h1>
      <div className="prose-stai mt-8">
        <p>
          STAI exists because the profession that verifies everything was getting its AI intelligence from
          vendors with something to sell. We write for the people who sign: partners, quality leads, senior
          practitioners across European audit, accountancy and finance.
        </p>
        <p>
          The desk runs on three commitments. <strong>Evidence first</strong> — claims carry citations, our
          assistant answers only from published research, and when the shelf is empty it says so.{" "}
          <strong>Practice over hype</strong> — every prompt, programme and briefing is built to survive contact
          with a real engagement file and a real inspector. <strong>Independence</strong> — we take no vendor
          money for coverage; training and membership are the entire business model, which means our only
          incentive is being right.
        </p>
        <p>
          Based in Amsterdam. Read by practitioners in fourteen countries.{" "}
          <Link href="/contact">Talk to us</Link> — especially if we got something wrong; corrections are the
          professional courtesy we appreciate most.
        </p>
      </div>
    </div>
  );
}
