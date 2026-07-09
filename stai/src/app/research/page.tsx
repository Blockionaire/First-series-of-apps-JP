import type { Metadata } from "next";
import { allResearch } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Research Desk",
  description:
    "Peer-reviewed and working-paper research on AI in audit and assurance, curated and translated into practice consequences.",
};

export default function ResearchPage() {
  const papers = allResearch();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Intelligence desk / 05
        </p>
        <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">The Research Desk</h1>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
          What the literature actually shows — each paper read in full, summarised honestly, and translated
          into the one takeaway a practice leader should act on.
        </p>
      </header>

      <ol>
        {papers.map((r, i) => (
          <li key={r.id} className="border-t rule last:border-b">
            <details className="group">
              <summary className="grid cursor-pointer list-none gap-x-6 gap-y-1 py-5 sm:grid-cols-[4rem_1fr_auto] sm:items-baseline [&::-webkit-details-marker]:hidden">
                <span className="index-num pt-1">{String(i + 1).padStart(2, "0")} /</span>
                <span>
                  <span className="block text-lg font-medium leading-snug text-cream-100">{r.title}</span>
                  <span className="f-mono mt-1 block text-[0.65rem] tracking-[0.08em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {r.authors} · {r.source} · {r.year}
                  </span>
                </span>
                <span className="f-mono text-[0.62rem] font-semibold tracking-[0.16em] uppercase text-cream-400">
                  {r.topic}
                </span>
              </summary>
              <div className="grid gap-6 pb-7 sm:grid-cols-2 sm:pl-[5.5rem]">
                <div>
                  <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                    What it shows
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {r.summary}
                  </p>
                </div>
                <div className="border-l pl-6 rule">
                  <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                    The STAI takeaway
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-cream-200">{r.takeaway}</p>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
