"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QUESTIONS, BANDS, bandFor } from "@/lib/assessment";
import { FIRM_SIZES, JURISDICTIONS, FIRM_ROLES } from "@/lib/firms";

type Stage = "intro" | "quiz" | "result";

const DIMENSIONS = ["Governance", "People", "Practice", "Evidence"] as const;

type Benchmark = {
  ready: boolean;
  sample: number;
  cohort: string;
  median: number | null;
  percentile: number | null;
  dimensionMedians: Record<string, number> | null;
};

export default function AssessmentQuiz() {
  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<(number | null)[]>(Array(QUESTIONS.length).fill(null));
  const [idx, setIdx] = useState(0);
  const [profile, setProfile] = useState({
    email: "",
    firm: "",
    firmSize: "",
    jurisdiction: "",
    role: "",
  });
  const [emailState, setEmailState] = useState<"idle" | "busy" | "done">("idle");
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const setP =
    (k: keyof typeof profile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setProfile((p) => ({ ...p, [k]: e.target.value }));

  const score = useMemo(() => answers.reduce((s: number, a) => s + (a ?? 0), 0), [answers]);
  const band = bandFor(score);

  const dims = useMemo(
    () =>
      DIMENSIONS.map((d) => {
        const qs = QUESTIONS.map((q, i) => ({ q, i })).filter(({ q }) => q.dimension === d);
        const got = qs.reduce((s, { i }) => s + (answers[i] ?? 0), 0);
        return { name: d, got, max: qs.length * 3 };
      }),
    [answers]
  );
  const weakest = useMemo(() => [...dims].sort((a, b) => a.got / a.max - b.got / b.max)[0], [dims]);

  function choose(v: number) {
    const next = [...answers];
    next[idx] = v;
    setAnswers(next);
    setTimeout(() => {
      if (idx < QUESTIONS.length - 1) {
        setIdx(idx + 1);
        liveRef.current?.focus();
      } else {
        finish(next as number[]);
      }
    }, 220);
  }

  async function finish(final: number[]) {
    setStage("result");
    const total = final.reduce((s, a) => s + a, 0);
    // Record the anonymous result immediately; the id lets a later profile
    // submission enrich the same row rather than double-counting the firm.
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: final, score: total, band: bandFor(total).name }),
      });
      const j = await res.json();
      if (j.id) setResultId(j.id);
      if (j.benchmark) setBenchmark(j.benchmark);
    } catch {
      /* the result renders regardless */
    }
  }

  async function sendResult(e: React.FormEvent) {
    e.preventDefault();
    setEmailState("busy");
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resultId, answers, score, band: band.name, ...profile }),
      });
      const j = await res.json();
      if (j.benchmark) setBenchmark(j.benchmark);
      setEmailState("done");
    } catch {
      setEmailState("idle");
    }
  }

  if (stage === "intro") {
    return (
      <div className="border bg-navy-950 p-6 rule-strong sm:p-10">
        <p className="f-mono text-[0.7rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
          8 questions · ~3 minutes · scored against European field data
        </p>
        <h2 className="f-display mt-4 max-w-xl text-3xl text-cream-100 sm:text-4xl">
          Four dimensions: governance, people, practice, evidence.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          The questions are the ones supervisors are starting to ask. Answer for how your firm actually operates
          — not the policy binder version. You&apos;ll get your maturity band, the dimension inspectors would
          probe first, and your next three moves.
        </p>
        <button type="button" className="btn btn-primary mt-6" onClick={() => setStage("quiz")}>
          Begin the assessment
        </button>
      </div>
    );
  }

  if (stage === "quiz") {
    const q = QUESTIONS[idx];
    return (
      <div className="border bg-navy-950 rule-strong">
        <div className="flex items-center justify-between border-b px-5 py-3 rule">
          <span className="f-mono text-[0.7rem] font-semibold tabular-nums tracking-[0.14em] text-cream-100">
            Q {String(idx + 1).padStart(2, "0")} / {String(QUESTIONS.length).padStart(2, "0")}
          </span>
          <span className="f-label" style={{ color: "var(--ink-faint)" }}>
            {q.dimension}
          </span>
        </div>
        <div className="flex h-[3px] w-full" aria-hidden>
          {QUESTIONS.map((_, i) => (
            <span
              key={i}
              className="h-full flex-1"
              style={{ background: i < idx ? "var(--color-cream-400)" : i === idx ? "var(--line-strong)" : "var(--line)" }}
            />
          ))}
        </div>
        <div ref={liveRef} tabIndex={-1} className="p-5 focus:outline-none sm:p-8">
          <h2 className="max-w-2xl text-xl font-medium leading-snug text-cream-100 sm:text-2xl">{q.text}</h2>
          <div className="mt-6 grid gap-2" role="radiogroup" aria-label={q.text}>
            {q.options.map((opt, v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={answers[idx] === v}
                onClick={() => choose(v)}
                className={`group flex items-baseline gap-4 border px-4 py-3.5 text-left transition-colors ${
                  answers[idx] === v ? "border-cream-400 bg-navy-800" : "rule hover:border-[var(--line-strong)] hover:bg-navy-850"
                }`}
              >
                <span className="index-num shrink-0">{String.fromCharCode(65 + v)}</span>
                <span className="text-[0.95rem] leading-snug text-cream-200 group-hover:text-cream-100">{opt}</span>
              </button>
            ))}
          </div>
          {idx > 0 && (
            <button
              type="button"
              onClick={() => setIdx(idx - 1)}
              className="f-mono mt-6 text-[0.7rem] tracking-[0.12em] uppercase text-cream-400 hover:text-cream-100"
            >
              ← Previous question
            </button>
          )}
        </div>
      </div>
    );
  }

  // result
  return (
    <div className="border bg-navy-950 rule-strong">
      <div className="border-b px-5 py-3 rule">
        <span className="f-label" style={{ color: "var(--ink-faint)" }}>
          Assessment result — {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="f-mono text-[0.7rem] tracking-[0.16em] uppercase" style={{ color: "var(--ink-faint)" }}>
            Your firm&apos;s band
          </p>
          <p className="f-display mt-2 text-5xl text-cream-100 sm:text-6xl">{band.name}</p>
          <p className="f-mono mt-2 text-sm tabular-nums text-cream-400">
            {score} / 24 · band {BANDS.findIndex((b) => b.key === band.key) + 1} of 4
          </p>

          <div className="mt-6 space-y-3">
            {dims.map((d) => (
              <div key={d.name}>
                <div className="flex justify-between">
                  <span className="f-label" style={{ color: "var(--ink-muted)" }}>
                    {d.name}
                  </span>
                  <span className="f-mono text-[0.65rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                    {d.got}/{d.max}
                  </span>
                </div>
                <div className="mt-1 h-[6px] w-full border rule">
                  <div className="h-full bg-cream-400" style={{ width: `${(d.got / d.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            <span className="text-cream-100">Inspectors would probe {weakest.name.toLowerCase()} first</span> —
            it&apos;s your thinnest evidence base relative to the claims the other dimensions imply.
          </p>
        </div>

        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            The read
          </p>
          <p className="mt-2 leading-relaxed text-cream-200">{band.verdict}</p>

          <p className="f-label mt-6" style={{ color: "var(--ink-faint)" }}>
            Your next three moves
          </p>
          <ol className="mt-2 space-y-3">
            {band.moves.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                <span className="index-num shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span>{m}</span>
              </li>
            ))}
          </ol>

          {/* ——— Peer benchmark ——— */}
          <div className="mt-8 border-t pt-5 rule">
            <p className="f-label" style={{ color: "var(--ink-faint)" }}>
              Against your peers
            </p>
            {benchmark?.ready ? (
              <div className="mt-2">
                <p className="leading-relaxed text-cream-200">
                  You scored <span className="f-mono font-bold">{score}</span>. The median across{" "}
                  {benchmark.cohort} is <span className="f-mono font-bold">{benchmark.median}</span> — putting
                  you at the{" "}
                  <span className="f-mono font-bold text-cream-100">{benchmark.percentile}th percentile</span>.
                </p>
                {benchmark.dimensionMedians && (
                  <ul className="mt-3 space-y-1.5">
                    {dims.map((d) => {
                      const peer = benchmark.dimensionMedians![d.name] ?? 0;
                      const delta = d.got - peer;
                      return (
                        <li key={d.name} className="f-mono flex items-baseline gap-3 text-[0.72rem]">
                          <span className="w-24" style={{ color: "var(--ink-muted)" }}>
                            {d.name}
                          </span>
                          <span className="tabular-nums text-cream-100">
                            {d.got} vs {peer}
                          </span>
                          <span
                            className="tabular-nums"
                            style={{ color: delta >= 0 ? "var(--color-signal-up)" : "var(--color-signal-down)" }}
                          >
                            {delta >= 0 ? "+" : ""}
                            {delta}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="f-mono mt-3 text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                  n={benchmark.sample} firms · updates as the dataset grows
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                Your response has joined the dataset. We hold peer comparisons back until enough firms have
                taken part to make a percentile mean something — a benchmark built on a handful of responses is
                noise wearing a statistic, and we&apos;d flag that in anyone else&apos;s work.
                {benchmark ? ` Currently ${benchmark.sample} of 25 responses in.` : ""} Add your firm details
                below and we&apos;ll send your comparison the moment it opens.
              </p>
            )}
          </div>

          {/* ——— Firm capture ——— */}
          <div className="mt-6 border-t pt-5 rule">
            {emailState === "done" ? (
              <p className="f-mono text-[0.75rem] text-cream-100" role="status">
                Sent — the full result and your dimension breakdown are in your inbox.
              </p>
            ) : (
              <form onSubmit={sendResult}>
                <p className="f-label" style={{ color: "var(--ink-muted)" }}>
                  Email me this result, and place my firm in the benchmark
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="as-email" className="sr-only">
                      Work email
                    </label>
                    <input
                      id="as-email"
                      type="email"
                      required
                      className="input-stai"
                      placeholder="you@firm.eu *"
                      value={profile.email}
                      onChange={setP("email")}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="as-firm" className="sr-only">
                      Firm
                    </label>
                    <input
                      id="as-firm"
                      className="input-stai"
                      placeholder="Firm"
                      value={profile.firm}
                      onChange={setP("firm")}
                      autoComplete="organization"
                    />
                  </div>
                  <div>
                    <label htmlFor="as-size" className="sr-only">
                      Firm size
                    </label>
                    <select id="as-size" className="input-stai" value={profile.firmSize} onChange={setP("firmSize")}>
                      <option value="">Firm size…</option>
                      {FIRM_SIZES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="as-jur" className="sr-only">
                      Jurisdiction
                    </label>
                    <select id="as-jur" className="input-stai" value={profile.jurisdiction} onChange={setP("jurisdiction")}>
                      <option value="">Jurisdiction…</option>
                      {JURISDICTIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="as-role" className="sr-only">
                      Your role
                    </label>
                    <select id="as-role" className="input-stai" value={profile.role} onChange={setP("role")}>
                      <option value="">Your role…</option>
                      {FIRM_ROLES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="submit" className="btn btn-primary" disabled={emailState === "busy"}>
                    {emailState === "busy" ? "…" : "Send it"}
                  </button>
                  <p className="f-mono text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                    Size and jurisdiction sharpen your comparison. Nothing is published firm-by-firm.
                  </p>
                </div>
              </form>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/firms" className="btn btn-ghost">
              Close the gap — STAI for firms
            </Link>
            <button
              type="button"
              className="f-mono text-[0.7rem] tracking-[0.12em] uppercase text-cream-400 hover:text-cream-100"
              onClick={() => {
                setAnswers(Array(QUESTIONS.length).fill(null));
                setIdx(0);
                setStage("quiz");
                setEmailState("idle");
              }}
            >
              Retake ↺
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
