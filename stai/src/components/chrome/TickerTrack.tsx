"use client";

import { useEffect, useState } from "react";

type Item = { tag: string; label: string; detail: string; date: string; stai: boolean };

/**
 * The signal ticker. Marquee for users who accept motion; a static,
 * horizontally scrollable strip for those who don't. Pauses on hover
 * and on keyboard focus. Content duplicated only for the marquee loop.
 */
export default function TickerTrack({ items }: { items: Item[] }) {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const row = (ariaHidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden || undefined}>
      {items.map((it, i) => (
        <span key={i} className="f-mono inline-flex items-baseline gap-2 whitespace-nowrap px-6 text-[0.7rem]">
          <span
            className="font-bold tracking-[0.12em]"
            style={{ color: it.stai ? "var(--color-cream-100)" : "var(--ink-faint)" }}
          >
            {it.tag}
          </span>
          <span className="tracking-[0.02em] text-cream-400">{it.label}</span>
          {it.detail && <span style={{ color: "var(--ink-faint)" }}>· {it.detail}</span>}
          <span className="tabular-nums" style={{ color: "var(--ink-faint)" }}>
            {it.date}
          </span>
          <span className="pl-6" style={{ color: "var(--line-strong)" }}>
            /
          </span>
        </span>
      ))}
    </div>
  );

  // Until we know the motion preference, render the static variant (safe default).
  const marquee = reduced === false;

  return (
    <div
      className="relative border-y bg-navy-950/70 py-1.5 rule"
      role="region"
      aria-label="Live signals: regulation, standards and market intelligence"
    >
      {marquee ? (
        <div className="flex overflow-hidden">
          <div className="ticker-track flex" style={{ ["--ticker-duration" as string]: `${items.length * 7}s` }}>
            {row(false)}
            {row(true)}
          </div>
        </div>
      ) : (
        <div className="panel-scroll flex overflow-x-auto">{row(false)}</div>
      )}
    </div>
  );
}
