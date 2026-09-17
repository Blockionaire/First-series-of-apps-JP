"use client";

import { useEffect, useState } from "react";

const TARGET = new Date("2026-08-02T00:00:00+02:00").getTime();

function parts(now: number) {
  const ms = Math.max(0, TARGET - now);
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    past: ms === 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The EU AI Act enforcement clock — woven into the chrome site-wide.
 * Renders days server-side (no hydration mismatch: seconds only appear
 * after mount), ticks per-second unless the user prefers reduced motion,
 * in which case it ticks per-minute without the seconds field.
 */
export default function EnforcementClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), mq.matches ? 60_000 : 1000);
    return () => clearInterval(iv);
  }, []);

  const p = parts(now ?? Date.now());
  const time = now === null ? `${p.d}D —:—:—` : reduced ? `${p.d}D ${pad(p.h)}H ${pad(p.m)}M` : `${p.d}D ${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;

  return (
    <span
      className="f-mono inline-flex items-baseline gap-2 whitespace-nowrap"
      role="timer"
      aria-label={`EU AI Act enforcement in ${p.d} days`}
    >
      {!compact && (
        <span className="text-[0.625rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
          EU AI Act enforcement
        </span>
      )}
      <span className="text-[0.7rem] font-semibold tracking-[0.08em] text-cream-100 tabular-nums">
        {p.past ? "IN FORCE" : time}
      </span>
    </span>
  );
}
