import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Content editor — admin",
  description: "STAI briefing editor.",
  path: "/admin/content",
  noIndex: true,
});

export default async function AdminContentPage() {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/content");

  const articles = db()
    .prepare("SELECT id, slug, title, category, published_at, status, featured, premium FROM articles ORDER BY published_at DESC")
    .all() as { id: number; slug: string; title: string; category: string; published_at: string; status: string; featured: number; premium: number }[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            <Link href="/admin" className="hover:text-cream-100">
              Back office
            </Link>{" "}
            / content
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">Briefing editor</h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--ink-muted)" }}>
            Edits publish instantly — no redeploy. The search index and Ask STAI grounding refresh on save.
          </p>
        </div>
        <Link href="/admin/content/new" className="btn btn-primary">
          + New briefing
        </Link>
      </header>

      <ul className="mt-8">
        {articles.map((a) => (
          <li key={a.id} className="border-t rule">
            <Link href={`/admin/content/${a.id}`} className="grid gap-x-6 gap-y-1 py-4 hover:bg-navy-850 sm:grid-cols-[7rem_1fr_auto] sm:items-baseline">
              <span className="f-mono text-[0.68rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                {fmtDate(a.published_at)}
              </span>
              <span className="font-medium text-cream-100">{a.title}</span>
              <span className="f-mono flex gap-3 text-[0.62rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                <span>{a.category}</span>
                {a.featured > 0 && <span className="text-cream-400">FEAT {a.featured}</span>}
                {!!a.premium && <span className="text-gold-300">PLUS</span>}
                <span className={a.status === "published" ? "text-signal-up" : "text-cream-400"}>{a.status}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
