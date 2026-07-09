import type { Metadata } from "next";
import AssessmentQuiz from "@/components/assessment/AssessmentQuiz";
import EnforcementClock from "@/components/chrome/EnforcementClock";

export const metadata: Metadata = {
  title: "AI-readiness assessment",
  description:
    "Eight questions, scored against how European firms actually deploy AI. Your maturity band, the gaps inspectors would find first, and your next three moves.",
};

export default function AssessmentPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Free diagnostic
        </p>
        <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">The AI-readiness assessment</h1>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
          The questions supervisors are starting to ask, scored the way inspectors think. Answer honestly —
          the flattering version helps nobody, least of all in October.
        </p>
        <p className="f-mono mt-4 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
          <EnforcementClock />
        </p>
      </header>
      <AssessmentQuiz />
    </div>
  );
}
