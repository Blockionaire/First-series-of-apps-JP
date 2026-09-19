import Link from "next/link";
import type { Article } from "@/lib/content";
import { fmtDate } from "@/lib/format";
import { PlusBadge } from "@/components/Logo";

export function CategoryTag({ category }: { category: string }) {
  return (
    <span className="f-mono text-[0.65rem] font-semibold tracking-[0.16em] uppercase text-cream-400">
      {category}
    </span>
  );
}

export function Byline({ a }: { a: Article }) {
  return (
    <p className="f-mono text-[0.65rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
      {a.author} · <time dateTime={a.published_at}>{fmtDate(a.published_at)}</time> · {a.reading_min} min
    </p>
  );
}

/** Lead story — the front page's anchor. */
export function LeadCard({ a }: { a: Article }) {
  return (
    <article className="group relative">
      <Link href={`/briefing/${a.slug}`} className="block focus-visible:outline-offset-4">
        <div className="flex items-center gap-3">
          <span className="index-num">01</span>
          <CategoryTag category={a.category} />
          {a.urgency >= 3 && (
            <span className="f-mono text-[0.62rem] font-bold tracking-[0.16em] text-cream-100">● ACT-CRITICAL</span>
          )}
          {a.premium && <PlusBadge />}
        </div>
        <h2 className="f-display mt-4 text-[clamp(2rem,5vw,3.6rem)] text-cream-100 transition-colors group-hover:text-white">
          {a.title}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          {a.dek}
        </p>
        <div className="mt-4">
          <Byline a={a} />
        </div>
      </Link>
    </article>
  );
}

/** Numbered secondary card for front-page grid and lists. */
export function IndexCard({ a, num }: { a: Article; num: string }) {
  return (
    <article className="group border-t pt-4 rule">
      <Link href={`/briefing/${a.slug}`} className="block">
        <div className="flex items-center gap-3">
          <span className="index-num">{num}</span>
          <CategoryTag category={a.category} />
          {a.premium && <PlusBadge />}
        </div>
        <h3 className="f-display-wide mt-3 text-xl text-cream-100 transition-colors group-hover:text-white">
          {a.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm" style={{ color: "var(--ink-muted)" }}>
          {a.dek}
        </p>
        <div className="mt-3">
          <Byline a={a} />
        </div>
      </Link>
    </article>
  );
}

/** Compact row for "latest" rails. */
export function RowCard({ a }: { a: Article }) {
  return (
    <article className="group border-b py-3 rule">
      <Link href={`/briefing/${a.slug}`} className="flex items-baseline gap-4">
        <span className="f-mono w-14 shrink-0 text-[0.65rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
          {fmtDate(a.published_at).slice(0, 6)}
        </span>
        <span className="min-w-0">
          {/* Wraps freely — no truncate, no line clamp.
              This used to be `truncate`, which on a phone left about half a
              headline: "the compliance stack conv". Worse, `truncate` implies
              `white-space: nowrap`, and a nowrap child inside a bare `fr`
              grid track raises that track's minimum to the full sentence
              width — so instead of clipping the title it stretched the whole
              homepage 121px past the screen edge.
              A 2-line clamp was the obvious replacement and it is wrong too:
              measured at 320px, "Vendor due diligence for AI tools: the
              twelve questions" needs three lines, so the clamp went straight
              back to hiding the end of a headline. Row heights in a wire rail
              may vary; a title the reader cannot finish may not. */}
          <span className="block text-[0.95rem] font-medium text-cream-200 transition-colors group-hover:text-cream-100">
            {a.title}
            {a.premium && (
              <span className="ml-2 align-middle">
                <PlusBadge />
              </span>
            )}
          </span>
          <span className="f-mono text-[0.62rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
            {a.category}
          </span>
        </span>
      </Link>
    </article>
  );
}
