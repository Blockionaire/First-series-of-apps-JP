"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type Gate = { id: string; label: string; passed: boolean; detail: string };

export type CandidateCard = {
  id: number;
  title: string;
  jurisdictions: string[];
  score: number | null;
  reasons: string;
  gates: Gate[];
  rejectedReason: string;
  wouldResearch: boolean;
  rank: number | null;
  selectedOn: string | null;
  firstSeen: string;
  lastSeen: string;
  updateCount: number;
  sourceCount: number;
  tier1: number;
  tier2: number;
  tier3: number;
  primary: number;
  feedbackCount: number;
  sources: { name: string; tier: number; url: string; relationship: string }[];
};

const VERDICTS = [
  { id: "good", label: "Good story" },
  { id: "not_relevant", label: "Not relevant" },
  { id: "duplicate", label: "Duplicate" },
  { id: "wrong_jurisdiction", label: "Wrong jurisdiction" },
] as const;

/**
 * The dry run's review surface.
 *
 * Every card answers the same seven questions in the same order, because the
 * reviewer's job is comparison, not reading: what is it, would it have been
 * researched, why or why not, on what evidence, which market, how long has it
 * been around, and has it moved since.
 *
 * Rejected stories are shown alongside selected ones deliberately. A list of
 * only the winners answers half the question — the dry run exists so a human
 * can say "you were wrong to drop that", and nobody can say it about
 * something they cannot see.
 */
export default function DryRunCandidates({ cards }: { cards: CandidateCard[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  async function submit(storyId: number, verdict: string) {
    setBusy(storyId);
    setError("");
    try {
      const res = await fetch("/api/admin/newsroom/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, verdict, note: notes[storyId] ?? "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSaved((s) => ({ ...s, [storyId]: verdict }));
      setNotes((n) => ({ ...n, [storyId]: "" }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that");
    } finally {
      setBusy(null);
    }
  }

  if (cards.length === 0) {
    return (
      <p className="mt-6 text-sm" style={{ color: "var(--ink-muted)" }}>
        No candidates yet. Activate some sources, mark them retrievable, and run discovery.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {error && (
        <p className="f-mono text-[0.75rem]" style={{ color: "var(--danger, #d88)" }}>
          {error}
        </p>
      )}

      {cards.map((c) => {
        const failed = c.gates.filter((g) => !g.passed);
        const isOpen = open === c.id;
        return (
          <article
            key={c.id}
            className="border p-5 rule"
            style={
              c.wouldResearch
                ? { borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.04)" }
                : undefined
            }
          >
            {/* verdict line — the first thing to read */}
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="f-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-gold-300">
                {c.wouldResearch
                  ? `Would research · rank ${c.rank ?? "—"}${c.selectedOn ? ` on ${c.selectedOn}` : ""}`
                  : failed.length > 0
                    ? "Filtered out"
                    : `Qualified, not selected · rank ${c.rank ?? "—"}`}
              </p>
              <p className="f-mono text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
                {c.score === null ? "unscored" : `relevance ${c.score}`}
              </p>
            </div>

            <h3 className="f-display mt-2 text-xl text-cream-100">{c.title}</h3>

            {/* why */}
            {c.rejectedReason ? (
              <p className="mt-2 text-[0.85rem]" style={{ color: "var(--ink-muted)" }}>
                <span className="text-cream-200">Rejected:</span> {c.rejectedReason}
              </p>
            ) : (
              c.reasons && (
                <p className="mt-2 text-[0.85rem]" style={{ color: "var(--ink-muted)" }}>
                  <span className="text-cream-200">Selected because:</span> {c.reasons}
                </p>
              )
            )}

            {/* provenance */}
            <p className="f-mono mt-3 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
              {c.jurisdictions.join(", ") || "no jurisdiction"} · {c.sourceCount} source
              {c.sourceCount === 1 ? "" : "s"} ({c.tier1} T1 / {c.tier2} T2 / {c.tier3} T3,{" "}
              {c.primary} primary) · first seen {c.firstSeen.slice(0, 16).replace("T", " ")} · last{" "}
              {c.lastSeen.slice(0, 16).replace("T", " ")}
              {c.updateCount > 0 && ` · moved ${c.updateCount}×`}
            </p>

            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : c.id)}
              className="btn btn-ghost btn-sm mt-3"
            >
              {isOpen ? "Hide detail" : `Gates and sources (${c.gates.length} gates)`}
            </button>

            {isOpen && (
              <div className="mt-4 border-t pt-4 rule">
                <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                  Gates
                </p>
                <ul className="mt-2 space-y-1">
                  {c.gates.map((g) => (
                    <li key={g.id} className="text-[0.8rem]">
                      <span className={g.passed ? "text-cream-400" : "text-gold-300"}>
                        {g.passed ? "pass" : "FAIL"}
                      </span>{" "}
                      <span className="text-cream-200">{g.label}</span>
                      {g.detail && (
                        <span style={{ color: "var(--ink-faint)" }}> — {g.detail}</span>
                      )}
                    </li>
                  ))}
                </ul>

                <p className="f-label mt-4" style={{ color: "var(--ink-faint)" }}>
                  Sources
                </p>
                <ul className="mt-2 space-y-1">
                  {c.sources.map((s) => (
                    <li key={s.url} className="text-[0.8rem]">
                      <span className="f-mono text-[0.7rem] text-gold-300">T{s.tier}</span>{" "}
                      <span className="text-cream-200">{s.name}</span>{" "}
                      <span style={{ color: "var(--ink-faint)" }}>({s.relationship})</span>{" "}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline underline-offset-4 text-cream-400 hover:text-cream-100"
                      >
                        open
                      </a>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/admin/editorial/${c.id}`}
                  className="f-mono mt-4 inline-block text-[0.72rem] underline underline-offset-4 text-cream-400 hover:text-cream-100"
                >
                  Full record and history →
                </Link>
              </div>
            )}

            {/* feedback */}
            <div className="mt-4 border-t pt-4 rule">
              <p className="f-label" style={{ color: "var(--ink-faint)" }}>
                Your verdict{c.feedbackCount > 0 && ` · ${c.feedbackCount} recorded`}
              </p>
              <input
                type="text"
                value={notes[c.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                placeholder="Optional note — what the engine got right or wrong"
                className="mt-2 w-full border bg-transparent px-3 py-2 text-[0.85rem] rule text-cream-100"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {VERDICTS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => submit(c.id, v.id)}
                    className={saved[c.id] === v.id ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
