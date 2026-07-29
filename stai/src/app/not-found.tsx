import Link from "next/link";
import { allArticles } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function NotFound() {
  const latest = allArticles().slice(0, 4);

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="f-mono text-[0.7rem] tracking-[0.18em] uppercase" style={{ color: "var(--ink-faint)" }}>
        404 · No signal at this address
      </p>
      <h1 className="f-display mt-3 text-4xl text-cream-100 sm:text-6xl">
        Nothing on the desk here.
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        The page moved, or never existed. Neither is your problem — here&apos;s the way back to the intelligence.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/briefing" className="btn btn-primary">
          Open the Briefing
        </Link>
        <Link href="/ask" className="btn btn-ghost">
          Ask STAI instead
        </Link>
      </div>

      <section className="mt-12 border-t pt-6 rule">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Latest on the wire
        </p>
        <ul className="mt-3">
          {latest.map((a) => (
            <li key={a.id} className="border-b py-3 rule">
              <Link href={`/briefing/${a.slug}`} className="group block">
                <span className="text-[0.95rem] font-medium text-cream-200 group-hover:text-cream-100">
                  {a.title}
                </span>
                <span className="f-mono block text-[0.62rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                  {a.category}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
