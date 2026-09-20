"use client";

import { useEffect, useState } from "react";

type Live = { now: number; buckets: number[]; minutes: number };

/**
 * Visitors on the site right now.
 *
 * "Now" is the last five minutes — the window every analytics tool uses, and
 * a floor as much as a ceiling: anything shorter drops a reader who is
 * quietly working through a long briefing.
 *
 * Seeded from the server so the tile never flashes a zero it has not
 * measured, then polled. A failed poll keeps the last good number and says
 * when it was taken, rather than falling back to zero — "nobody is here" and
 * "I could not ask" are different facts and the tile must not conflate them.
 */
export default function LiveVisitors({ initial }: { initial: Live }) {
  const [live, setLive] = useState(initial);
  // Null until the browser has it. Seeding this with Date.now() would render
  // one clock on the server and a different one during hydration, which React
  // reports as a mismatch — and a "live" tile that warns on every load is not
  // a tile anyone trusts.
  const [at, setAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setAt(Date.now()); // the server-rendered reading is as of now, client-side
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Live;
        if (cancelled) return;
        setLive(data);
        setAt(Date.now());
        setStale(false);
      } catch {
        if (!cancelled) setStale(true);
      }
    };
    const iv = setInterval(tick, 20_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const quiet = live.buckets.every((b) => b === 0);
  const max = Math.max(...live.buckets, 1);

  return (
    <div className="border p-4 rule-strong">
      <div className="flex items-baseline justify-between gap-3">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          On the site now
        </p>
        <span className="f-mono inline-flex items-center gap-1.5 text-[0.6rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
          <span
            className={live.now > 0 && !stale ? "live-dot inline-block h-1.5 w-1.5 rounded-full" : "inline-block h-1.5 w-1.5 rounded-full"}
            style={{ background: stale ? "var(--color-signal-down)" : live.now > 0 ? "var(--color-signal-up)" : "var(--line-strong)" }}
            aria-hidden
          />
          {stale ? "stale" : "live"}
        </span>
      </div>

      <p className="f-mono mt-2 text-5xl font-bold tabular-nums text-cream-100" aria-live="polite">
        {live.now}
      </p>
      <p className="mt-1 text-[0.78rem]" style={{ color: "var(--ink-muted)" }}>
        distinct visitors in the last 5 minutes
      </p>

      {/* The last hour, in five-minute steps. When nothing happened, say so —
          a flat line at zero looks like a broken chart, not like quiet. */}
      {quiet ? (
        <p className="f-mono mt-4 text-[0.65rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
          No activity in the last {live.minutes} minutes.
        </p>
      ) : (
        <>
          <div className="mt-4 flex h-8 items-end gap-[3px]" aria-hidden>
            {live.buckets.map((n, i) => (
              <span
                key={i}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: `${Math.max((n / max) * 100, n > 0 ? 12 : 3)}%`,
                  background: n > 0 ? "var(--color-gold-500)" : "var(--line)",
                }}
                title={`${(live.buckets.length - i) * 5}–${(live.buckets.length - i - 1) * 5} min ago — ${n}`}
              />
            ))}
          </div>
          <p className="f-mono mt-1 text-[0.6rem]" style={{ color: "var(--ink-faint)" }}>
            last {live.minutes} minutes, 5-minute steps
          </p>
        </>
      )}

      <p className="f-mono mt-3 text-[0.6rem]" style={{ color: "var(--ink-faint)" }}>
        {stale ? "could not refresh — showing the last reading" : "refreshes every 20s"}
        {at !== null && (
          <>
            {" · "}
            <time dateTime={new Date(at).toISOString()}>{new Date(at).toISOString().slice(11, 19)} UTC</time>
          </>
        )}
      </p>
    </div>
  );
}
