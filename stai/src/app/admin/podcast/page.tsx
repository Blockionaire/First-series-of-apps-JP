import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Podcast — admin",
  description: "STAI episode list.",
  path: "/admin/podcast",
  noIndex: true,
});

type Row = {
  id: number;
  slug: string;
  episode_no: number;
  title: string;
  guest: string;
  published_at: string;
  duration_min: number;
  audio_url: string;
  status: string;
};

export default async function AdminPodcastPage() {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/podcast");

  // Admin reads see drafts, which is why this goes to the table rather than
  // through content.ts — that helper filters to published on purpose.
  const episodes = await sql().all<Row>(
    "SELECT id, slug, episode_no, title, guest, published_at, duration_min, audio_url, status FROM podcasts ORDER BY episode_no DESC"
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Back office
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">Podcast</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            The desk
          </Link>
          <Link href="/admin/podcast/new" className="btn btn-primary btn-sm">
            New episode
          </Link>
        </div>
      </header>

      {episodes.length === 0 ? (
        <p className="mt-8 text-sm" style={{ color: "var(--ink-muted)" }}>
          No episodes yet. One a week is the plan — the hub shows whatever is published here.
        </p>
      ) : (
        <ul className="mt-8 divide-y rule">
          {episodes.map((ep) => (
            <li key={ep.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
              <span className="f-mono w-8 shrink-0 text-[0.8rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                {String(ep.episode_no).padStart(2, "0")}
              </span>
              <Link href={`/admin/podcast/${ep.id}`} className="text-sm text-cream-200 hover:text-cream-100">
                {ep.title}
              </Link>
              <span className="f-mono text-[0.62rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                {ep.guest || "—"} · {fmtDate(ep.published_at)} · {ep.duration_min} min
              </span>
              {!ep.audio_url && (
                <span className="f-mono text-[0.6rem] tracking-[0.12em] uppercase" style={{ color: "var(--color-signal-down)" }}>
                  no link
                </span>
              )}
              <span
                className="f-mono ml-auto text-[0.6rem] tracking-[0.12em] uppercase"
                style={{ color: ep.status === "published" ? "var(--color-signal-up)" : "var(--ink-faint)" }}
              >
                {ep.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
