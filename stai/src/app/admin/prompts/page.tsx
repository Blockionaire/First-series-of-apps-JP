import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { promptCategories, type AdminPromptRow } from "@/lib/admin/prompts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Prompt library — admin",
  description: "STAI prompt library editor.",
  path: "/admin/prompts",
  noIndex: true,
});

type Search = { q?: string; cat?: string; st?: string };

export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/prompts");

  const { q = "", cat = "", st = "" } = await searchParams;
  const status = st === "published" || st === "draft" ? st : "";

  // Admin reads go straight to the table: this is the one surface that is
  // supposed to see drafts. Public reads go through lib/content.ts, which
  // filters them out.
  const where: string[] = [];
  const args: Record<string, string> = {};
  if (q.trim()) {
    where.push("(title LIKE @q OR slug LIKE @q OR description LIKE @q OR body LIKE @q)");
    args.q = `%${q.trim()}%`;
  }
  if (cat) {
    where.push("category = @cat");
    args.cat = cat;
  }
  if (status) {
    where.push("status = @st");
    args.st = status;
  }

  const stmt = db().prepare(
    `SELECT id, slug, title, category, premium, status, uses, updated_at FROM prompts
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY category ASC, title ASC`
  );
  // better-sqlite3 rejects a bound object on a statement that takes no
  // parameters, so the unfiltered case has to call through with nothing.
  const rows = (where.length ? stmt.all(args) : stmt.all()) as AdminPromptRow[];

  const categories = promptCategories();
  const totals = db()
    .prepare(
      `SELECT COUNT(*) AS all_n,
              COALESCE(SUM(status='published'), 0) AS live_n,
              COALESCE(SUM(status='published' AND premium=0), 0) AS free_n
       FROM prompts`
    )
    .get() as { all_n: number; live_n: number; free_n: number };

  const filtered = !!(q.trim() || cat || status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            <Link href="/admin" className="hover:text-cream-100">
              Back office
            </Link>{" "}
            / prompts
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">Prompt library</h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--ink-muted)" }}>
            {totals.live_n} of {totals.all_n} live, {totals.free_n} of those open to everyone. Saves take
            effect immediately — no redeploy. Prompts are never deleted here; unpublishing takes one off
            every public surface while keeping the text.
          </p>
        </div>
        <Link href="/admin/prompts/new" className="btn btn-primary">
          + New prompt
        </Link>
      </header>

      {/* A plain GET form: no client JS, bookmarkable, and it survives a reload. */}
      <form method="get" className="mt-8 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pf-q">
            Search
          </label>
          <input
            id="pf-q"
            name="q"
            defaultValue={q}
            placeholder="title, slug, description or body"
            className="input-stai mt-1.5"
          />
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pf-cat">
            Category
          </label>
          <select id="pf-cat" name="cat" defaultValue={cat} className="input-stai mt-1.5">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pf-st">
            Status
          </label>
          <select id="pf-st" name="st" defaultValue={status} className="input-stai mt-1.5">
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <button type="submit" className="btn btn-ghost">
          Filter
        </button>
        {filtered && (
          <Link href="/admin/prompts" className="f-mono text-[0.7rem] tracking-[0.1em] uppercase text-cream-400 underline underline-offset-4 hover:text-cream-100">
            Clear
          </Link>
        )}
      </form>

      <p className="f-mono mt-4 text-[0.68rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
        {rows.length} shown
      </p>

      <ul className="mt-2">
        {rows.map((p) => (
          <li key={p.id} className="border-t rule">
            <Link
              href={`/admin/prompts/${p.id}`}
              className="grid gap-x-6 gap-y-1 py-4 hover:bg-navy-850 sm:grid-cols-[11rem_1fr_auto] sm:items-baseline"
            >
              <span className="f-mono text-[0.65rem] tracking-[0.08em] uppercase" style={{ color: "var(--ink-faint)" }}>
                {p.category}
              </span>
              <span className="font-medium text-cream-100">
                {p.title}
                <span className="f-mono block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                  /prompts/{p.slug}
                  {p.updated_at ? ` · edited ${p.updated_at.slice(0, 16)}` : ""}
                </span>
              </span>
              <span className="f-mono flex gap-3 text-[0.62rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                <span className={p.premium ? "text-gold-300" : "text-cream-400"}>
                  {p.premium ? "STAI+" : "Free"}
                </span>
                <span className={p.status === "published" ? "text-signal-up" : "text-cream-400"}>
                  {p.status}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="border-t py-6 text-sm rule" style={{ color: "var(--ink-muted)" }}>
            Nothing matches those filters.
          </li>
        )}
      </ul>
    </div>
  );
}
