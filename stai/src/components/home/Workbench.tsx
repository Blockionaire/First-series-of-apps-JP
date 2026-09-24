"use client";

import Link from "next/link";
import { useRef, useState } from "react";

/**
 * The homepage's one piece of product UI: where the editorial page turns
 * engineered. A tabbed panel previewing the tools, each one gated by the same
 * site switch as its page, so a closed section never links into a 404.
 *
 * Keyboard: the tabs are a roving-tabindex tablist — arrow keys move between
 * them, Home/End jump to the ends — per the WAI-ARIA tabs pattern.
 */

export type BenchPrompt = { slug: string; title: string; category: string; premium: boolean };

type Props = {
  prompts: BenchPrompt[];
  show: { prompts: boolean; aiAct: boolean; ask: boolean; assessment: boolean; plus: boolean };
  /** ISO date the page was rendered, so timeline states are server-consistent. */
  today: string;
};

/** EU AI Act application dates, Regulation (EU) 2024/1689, Art. 113. */
const AI_ACT = [
  { date: "2025-02-02", label: "02 FEB 2025", what: "Prohibited practices and AI literacy" },
  { date: "2025-08-02", label: "02 AUG 2025", what: "General-purpose AI model obligations; governance" },
  { date: "2026-08-02", label: "02 AUG 2026", what: "Most obligations, including Annex III high-risk systems" },
  { date: "2027-08-02", label: "02 AUG 2027", what: "High-risk AI in regulated products (Annex I)" },
];

export default function Workbench({ prompts, show, today }: Props) {
  const tabs = [
    show.prompts && { id: "prompts", label: "Prompt Library" },
    show.aiAct && { id: "aiact", label: "AI Act Radar" },
    show.ask && { id: "ask", label: "Ask STAI" },
    show.assessment && { id: "assessment", label: "Assessment" },
  ].filter(Boolean) as { id: string; label: string }[];

  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (tabs.length === 0) return null;

  function onKey(e: React.KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  }

  const nextIndex = AI_ACT.findIndex((d) => d.date > today);

  return (
    <div className="ed-bench">
      <div role="tablist" aria-label="STAI tools" className="flex overflow-x-auto border-b rule">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`bench-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`bench-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className="ed-tab f-label shrink-0 border-b-2 border-transparent px-4 py-4 transition-colors hover:text-cream-100 sm:px-6"
            style={{ color: active === t.id ? undefined : "var(--ink-faint)" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`bench-panel-${t.id}`}
          aria-labelledby={`bench-tab-${t.id}`}
          hidden={active !== t.id}
          tabIndex={0}
          className="p-5 sm:p-8"
        >
          {t.id === "prompts" && (
            <div>
              <ul>
                {prompts.map((p) => (
                  <li key={p.slug} className="border-b rule last:border-b-0">
                    <Link href={`/prompts/${p.slug}`} className="group flex items-baseline gap-4 py-4">
                      <span className="f-mono hidden w-40 shrink-0 text-[0.62rem] uppercase tracking-[0.14em] sm:block" style={{ color: "var(--ink-faint)" }}>
                        {p.category}
                      </span>
                      <span className="flex-1 font-medium text-cream-100">
                        <span className="ed-hl">{p.title}</span>
                      </span>
                      <span
                        className={`f-mono shrink-0 text-[0.62rem] uppercase tracking-[0.14em] ${p.premium ? "text-gold-300" : ""}`}
                        style={p.premium ? undefined : { color: "var(--ink-faint)" }}
                      >
                        {p.premium ? "STAI+" : "Free"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm" style={{ color: "var(--ink-muted)" }}>
                <span>Vetted, guardrailed prompts — written like methodology, not magic tricks.</span>
                <Link href="/prompts" className="ed-link text-sm">
                  Browse the library
                </Link>
              </p>
            </div>
          )}

          {t.id === "aiact" && (
            <div>
              <ol className="grid gap-px sm:grid-cols-4" style={{ background: "var(--line)" }}>
                {AI_ACT.map((d, i) => {
                  const past = d.date <= today;
                  const next = i === nextIndex;
                  return (
                    <li key={d.date} className="p-4" style={{ background: "var(--color-navy-950)" }}>
                      <p className="f-mono text-[0.68rem] font-semibold tracking-[0.12em]" style={{ color: next ? "var(--ed-accent)" : "var(--color-cream-100)" }}>
                        {d.label}
                      </p>
                      <p className="f-mono mt-1 text-[0.6rem] uppercase tracking-[0.14em]" style={{ color: "var(--ink-faint)" }}>
                        {past ? "Applies" : next ? "Next" : "Ahead"}
                      </p>
                      <p className="mt-3 text-sm leading-snug text-cream-200">{d.what}</p>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm" style={{ color: "var(--ink-muted)" }}>
                <span className="f-mono text-[0.62rem] uppercase tracking-[0.14em]" style={{ color: "var(--ink-faint)" }}>
                  Regulation (EU) 2024/1689 · Art. 113
                </span>
                <Link href="/ai-act" className="ed-link text-sm">
                  Open the AI Act tracker
                </Link>
              </p>
            </div>
          )}

          {t.id === "ask" && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div aria-label="Example Ask STAI exchange">
                <p className="f-mono text-[0.72rem] tracking-[0.04em] text-cream-400">
                  <span style={{ color: "var(--ink-faint)" }}>you ›</span> Do we need to keep the prompts our team used on
                  an engagement?
                </p>
                <div className="f-mono mt-4 space-y-3 border-t pt-4 text-[0.8rem] leading-relaxed rule text-cream-200">
                  <p>
                    Yes — if an AI output influenced an audit conclusion, the prompt is audit documentation under ISA 230:
                    it is the procedure design, and reperformance is impossible without it{" "}
                    <span className="text-cream-400">[1]</span>. The emerging practice is a single AI-procedures memo per
                    engagement recording tools, populations and human review <span className="text-cream-400">[2]</span>.
                  </p>
                  <p className="text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                    [1] The prompt is the new working paper · [2] What CSRD assurance teams actually need from AI
                  </p>
                </div>
              </div>
              <div className="lg:border-l lg:pl-8 rule">
                <p className="ed-serif text-2xl leading-snug text-cream-100">
                  Answers with an evidence trail. <span className="ed-italic">If the desk hasn&apos;t covered it, it says so.</span>
                </p>
                <Link href="/ask" className="ed-link mt-5 inline-block text-sm">
                  Ask a question
                </Link>
              </div>
            </div>
          )}

          {t.id === "assessment" && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-end">
              <div>
                <p className="f-mono text-[0.62rem] uppercase tracking-[0.14em]" style={{ color: "var(--ink-faint)" }}>
                  Free diagnostic · 8 questions · 3 minutes
                </p>
                <p className="ed-serif mt-3 text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-cream-100">
                  Where does your firm actually stand?
                </p>
                <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  Your maturity band, the gaps an inspector would find first, and the next three moves — scored instantly.
                </p>
              </div>
              <div>
                <Link href="/assessment" className="btn btn-primary">
                  Take the assessment
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
