"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { openWorkingPaper } from "@/lib/workingPaper";

const SECTORS = [
  "Financial services — banking",
  "Financial services — insurance",
  "Manufacturing & industrials",
  "Technology & software",
  "Energy & utilities",
  "Real estate & construction",
  "Retail & consumer",
  "Healthcare & life sciences",
  "Public sector & NFP",
  "Logistics & transport",
];

const JURISDICTIONS = [
  "Netherlands",
  "Germany",
  "Belgium",
  "France",
  "Denmark",
  "Sweden",
  "Norway",
  "Ireland",
  "Luxembourg",
  "Spain",
  "Italy",
  "Austria",
  "Other EU / EEA",
];

const FRAMEWORKS = [
  "IFRS + ISA",
  "Dutch GAAP (Title 9) + Dutch Standards",
  "German HGB + IDW standards",
  "IFRS + ESRS (CSRD engagement)",
  "US GAAP + PCAOB (EU component)",
  "Local GAAP + ISA",
];

type Phase = "idle" | "running" | "done" | "error";

const RUN_LINES = [
  "› parsing base prompt structure…",
  "› mapping engagement context to task sections…",
  "› aligning terminology to framework…",
  "› checking guardrails survive adaptation…",
  "› composing rationale…",
];

export default function AdaptPanel({
  slug,
  promptTitle,
  locked,
  authed,
}: {
  slug: string;
  promptTitle: string;
  locked: boolean;
  authed: boolean;
}) {
  const [client, setClient] = useState("");
  const [sector, setSector] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [framework, setFramework] = useState("");
  const [situation, setSituation] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [runLine, setRunLine] = useState(0);
  const [adapted, setAdapted] = useState("");
  const [rationale, setRationale] = useState<string[]>([]);
  const [engine, setEngine] = useState<"ai" | "offline">("ai");
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "running") return;
    const iv = setInterval(() => setRunLine((l) => Math.min(l + 1, RUN_LINES.length - 1)), 1400);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === "done") resultRef.current?.focus();
  }, [phase]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setPhase("running");
    setRunLine(0);
    setError("");
    try {
      const res = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, client, sector, jurisdiction, framework, situation }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Adaptation failed");
      setAdapted(j.adapted);
      setRationale(j.rationale ?? []);
      setEngine(j.engine ?? "ai");
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adaptation failed");
      setPhase("error");
    }
  }

  const contextRows = [
    { label: "Client", value: client },
    { label: "Sector", value: sector },
    { label: "Jurisdiction", value: jurisdiction },
    { label: "Framework", value: framework },
    { label: "Situation", value: situation },
  ].filter((r) => r.value);

  if (locked) {
    return (
      <section
        aria-label="Adapt with AI — STAI+ feature"
        className="border p-6"
        style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.05)" }}
      >
        <p className="f-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-gold-300">
          Adapt with AI — STAI+
        </p>
        <h2 className="f-display mt-2 text-2xl text-cream-100">This prompt, rewritten for your engagement.</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Hand it your client, sector, jurisdiction and framework — STAI rewrites the prompt for that exact
          situation with the guardrails intact, and tells you what changed and why. Then export it as a
          working paper.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/plus" className="btn btn-plus premium-focus">
            Unlock with STAI+
          </Link>
          {!authed && (
            <Link href={`/login?next=/prompts/${slug}`} className="btn btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Adapt with AI" className="border rule-strong">
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3"
        style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.06)" }}
      >
        <p className="f-mono text-[0.68rem] font-bold tracking-[0.18em] uppercase text-gold-300">
          Adapt with AI
        </p>
        <p className="f-mono text-[0.62rem] tracking-[0.08em]" style={{ color: "var(--ink-faint)" }}>
          STAI+ · guardrails preserved · export as working paper
        </p>
      </div>

      <form onSubmit={run} className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ad-client" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Client (anonymise if you prefer)
          </label>
          <input
            id="ad-client"
            className="input-stai mt-1.5"
            placeholder="e.g. mid-cap listed logistics group, ~€800m revenue"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ad-sector" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Sector
          </label>
          <input
            id="ad-sector"
            className="input-stai mt-1.5"
            list="ad-sectors"
            placeholder="Choose or type…"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          />
          <datalist id="ad-sectors">
            {SECTORS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="ad-jur" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Jurisdiction
          </label>
          <input
            id="ad-jur"
            className="input-stai mt-1.5"
            list="ad-jurs"
            placeholder="Choose or type…"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
          />
          <datalist id="ad-jurs">
            {JURISDICTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="ad-fw" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Applicable framework / standards
          </label>
          <input
            id="ad-fw"
            className="input-stai mt-1.5"
            list="ad-fws"
            placeholder="Choose or type…"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
          />
          <datalist id="ad-fws">
            {FRAMEWORKS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ad-sit" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Situation (what makes this engagement specific)
          </label>
          <textarea
            id="ad-sit"
            className="input-stai mt-1.5 min-h-20 resize-y"
            placeholder="e.g. first-year audit, prior auditor resigned; significant ERP migration in Q3; group reports under IFRS with a UK sub-consolidation"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 sm:col-span-2">
          <button type="submit" className="btn btn-plus premium-focus" disabled={phase === "running"}>
            {phase === "running" ? "Adapting…" : "Adapt this prompt"}
          </button>
          {phase === "error" && (
            <p role="alert" className="f-mono text-[0.7rem] text-signal-down">
              {error}
            </p>
          )}
        </div>
      </form>

      {phase === "running" && (
        <div className="border-t px-5 py-4 rule" role="status" aria-label="Adaptation in progress">
          {RUN_LINES.slice(0, runLine + 1).map((l, i) => (
            <p
              key={l}
              className={`f-mono text-[0.72rem] leading-relaxed ${i === runLine ? "cursor-blink text-cream-200" : ""}`}
              style={i === runLine ? undefined : { color: "var(--ink-faint)" }}
            >
              {l}
            </p>
          ))}
        </div>
      )}

      {phase === "done" && (
        <div ref={resultRef} tabIndex={-1} className="border-t rule focus:outline-none">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="f-mono text-[0.68rem] font-semibold tracking-[0.14em] uppercase text-cream-100">
              Adapted for your engagement
              {engine === "offline" && (
                <span className="ml-2 font-normal" style={{ color: "var(--ink-faint)" }}>
                  · offline merge (AI service not configured)
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <CopyButton text={adapted} label="Copy adapted prompt" />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  openWorkingPaper({
                    kind: "ADAPTED PROMPT",
                    title: promptTitle,
                    body: adapted,
                    context: contextRows,
                  })
                }
              >
                Export working paper
              </button>
            </div>
          </div>
          <pre className="panel-scroll mx-5 mb-5 max-h-[28rem] overflow-auto border bg-navy-950 p-4 text-[0.8rem] leading-relaxed whitespace-pre-wrap rule f-mono text-cream-200">
            {adapted}
          </pre>
          {rationale.length > 0 && (
            <div className="border-t px-5 py-4 rule">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                What changed, and why
              </p>
              <ul className="mt-2 space-y-1.5">
                {rationale.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--ink-muted)" }}>
                    <span className="index-num shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
