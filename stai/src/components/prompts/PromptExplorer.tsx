"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlusBadge } from "@/components/Logo";

export type PromptCard = {
  slug: string;
  title: string;
  category: string;
  description: string;
  premium: boolean;
  uses: number;
  variables: number;
};

export default function PromptExplorer({ items, isPlus }: { items: PromptCard[]; isPlus: boolean }) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [access, setAccess] = useState<"all" | "free">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (access === "free" && p.premium) return false;
      if (!needle) return true;
      return (p.title + " " + p.description + " " + p.category).toLowerCase().includes(needle);
    });
  }, [items, q, cat, access]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b pb-4 rule">
        <label htmlFor="prompt-search" className="sr-only">
          Search prompts
        </label>
        <input
          id="prompt-search"
          type="search"
          placeholder="Search: risk, CSRD, memo, journal…"
          className="input-stai f-mono w-full text-[0.8rem] sm:w-72"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`f-mono border px-2.5 py-1.5 text-[0.65rem] tracking-[0.1em] uppercase transition-colors ${
                cat === c
                  ? "border-cream-400 bg-cream-200 font-bold text-navy-900"
                  : "rule text-cream-400 hover:border-[var(--line-strong)] hover:text-cream-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {!isPlus && (
          <button
            type="button"
            onClick={() => setAccess(access === "all" ? "free" : "all")}
            aria-pressed={access === "free"}
            className="f-mono ml-auto border px-3 py-1.5 text-[0.65rem] tracking-[0.1em] uppercase rule-strong text-cream-400 hover:text-cream-100"
          >
            {access === "free" ? "Showing free only" : "Show free only"}
          </button>
        )}
      </div>

      <p className="f-label mt-4" style={{ color: "var(--ink-faint)" }}>
        {filtered.length} {filtered.length === 1 ? "prompt" : "prompts"}
        {cat !== "All" ? ` · ${cat}` : ""}
      </p>

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Link
            key={p.slug}
            href={`/prompts/${p.slug}`}
            className="group flex h-full flex-col border bg-navy-850 p-5 transition-colors rule hover:border-[var(--line-strong)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="f-mono text-[0.6rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
                {p.category}
              </span>
              {p.premium ? (
                <PlusBadge />
              ) : (
                <span className="f-mono text-[0.6rem] tracking-[0.14em] uppercase text-cream-400">Free</span>
              )}
            </div>
            <h2 className="f-display-wide mt-3 text-lg leading-tight text-cream-100 group-hover:text-white">
              {p.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              {p.description}
            </p>
            <p className="f-mono mt-4 flex items-center justify-between text-[0.62rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
              <span>
                {p.variables} {p.variables === 1 ? "variable" : "variables"}
                {p.uses > 0 ? ` · ${p.uses} uses` : ""}
              </span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </p>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-10 text-sm" style={{ color: "var(--ink-muted)" }}>
          No prompts match. Try a task word — “memo”, “journal”, “materiality”.
        </p>
      )}
    </div>
  );
}
