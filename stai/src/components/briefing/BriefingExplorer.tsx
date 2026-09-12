"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Radar, { type RadarItem } from "./Radar";
import { fmtDate } from "@/lib/format";
import { PlusBadge } from "@/components/Logo";

const CATEGORIES = ["All", "Regulation", "Analysis", "Practice", "Tools", "News"];

export default function BriefingExplorer({ items }: { items: RadarItem[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [showRadar, setShowRadar] = useState(true);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((a) => {
      if (cat !== "All" && a.category !== cat) return false;
      if (!needle) return true;
      return (a.title + " " + a.dek + " " + a.author).toLowerCase().includes(needle);
    });
  }, [items, q, cat]);

  return (
    <div>
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3 border-b pb-4 rule">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`f-mono border px-3 py-1.5 text-[0.68rem] tracking-[0.12em] uppercase transition-colors ${
                cat === c
                  ? "border-cream-400 bg-cream-200 font-bold text-navy-900"
                  : "rule text-cream-400 hover:border-[var(--line-strong)] hover:text-cream-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label htmlFor="briefing-search" className="sr-only">
            Search the briefing
          </label>
          <input
            id="briefing-search"
            type="search"
            placeholder="Search the desk…"
            className="input-stai f-mono w-48 text-[0.8rem] sm:w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowRadar((v) => !v)}
            aria-pressed={showRadar}
            className="f-mono hidden border px-3 py-2 text-[0.68rem] tracking-[0.12em] uppercase rule-strong text-cream-400 hover:text-cream-100 sm:block"
          >
            {showRadar ? "Hide radar" : "Show radar"}
          </button>
        </div>
      </div>

      {/* radar — a lens, never a gate */}
      {showRadar && (
        <div className="mt-6 hidden sm:block">
          <Radar items={filtered.length > 0 ? filtered : items} />
        </div>
      )}

      {/* index */}
      <div className="mt-8">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
          {cat !== "All" ? ` · ${cat}` : ""}
          {q ? ` · matching “${q}”` : ""}
        </p>
        <div className="mt-3">
          {filtered.map((a, i) => (
            <article key={a.slug} className="group border-b rule">
              <Link
                href={`/briefing/${a.slug}`}
                className="grid gap-x-6 gap-y-1 py-5 sm:grid-cols-[6rem_7rem_1fr_auto] sm:items-baseline"
              >
                <span className="index-num">{String(i + 1).padStart(2, "0")} /</span>
                <span className="f-mono text-[0.68rem] tabular-nums tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
                  {fmtDate(a.publishedAt)}
                </span>
                <span className="min-w-0">
                  <span className="f-display-wide block text-xl text-cream-100 transition-colors group-hover:text-white sm:text-2xl">
                    {a.title}
                  </span>
                  <span className="mt-1 block max-w-3xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {a.dek}
                  </span>
                  <span className="f-mono mt-2 block text-[0.62rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {a.author} · {a.readingMin} min
                  </span>
                </span>
                <span className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <span className="f-mono text-[0.62rem] font-semibold tracking-[0.16em] uppercase text-cream-400">
                    {a.category}
                  </span>
                  {a.premium && <PlusBadge />}
                  {a.urgency >= 3 && (
                    <span className="f-mono text-[0.6rem] font-bold tracking-[0.14em] text-cream-100">● ACT</span>
                  )}
                </span>
              </Link>
            </article>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-sm" style={{ color: "var(--ink-muted)" }}>
              Nothing on the desk matches. Try a broader term — or{" "}
              <Link href="/ask" className="text-cream-100 underline underline-offset-4">
                ask STAI directly
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
