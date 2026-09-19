import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { jsonArray } from "@/lib/content";
import ArticleEditor, { type EditorArticle } from "@/components/admin/ArticleEditor";

export const dynamic = "force-dynamic";

/**
 * The row as the editor needs it: every EditorArticle field except the two the
 * database stores differently — `tags` is JSON text rather than a joined
 * string, and `premium` is 0/1 rather than a boolean.
 */
type AdminArticleRow = Omit<EditorArticle, "id" | "tags" | "premium"> & {
  id: number;
  tags: string;
  premium: number;
};

export const metadata: Metadata = pageMeta({
  title: "Edit briefing — admin",
  description: "STAI briefing editor.",
  path: "/admin/content",
  noIndex: true,
});

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/content");

  const { id } = await params;
  let initial: EditorArticle;

  if (id === "new") {
    initial = {
      id: null,
      slug: "",
      title: "",
      dek: "",
      category: "Analysis",
      tags: "",
      author: "STAI Desk",
      author_role: "Newsroom",
      published_at: new Date().toISOString().slice(0, 10),
      reading_min: 6,
      featured: 0,
      urgency: 2,
      premium: false,
      status: "published",
      body_md: "",
    };
  } else {
    // Admin reads query the table directly and deliberately see drafts, so
    // this cannot go through content.ts — but it must share its tolerance for
    // a malformed tags column. An unguarded JSON.parse here is the worst place
    // for one: it would 500 the very editor you would open to repair the row.
    const row = await sql().first<AdminArticleRow>("SELECT * FROM articles WHERE id=?", [
      Number(id),
    ]);
    if (!row) notFound();
    initial = {
      ...row,
      premium: !!row.premium,
      tags: jsonArray(row.tags, `articles.tags for "${row.slug}"`).join(", "),
    };
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        <Link href="/admin/content" className="hover:text-cream-100">
          Briefing editor
        </Link>{" "}
        / {id === "new" ? "new" : `#${id}`}
      </p>
      <h1 className="f-display mt-2 mb-8 text-3xl text-cream-100">
        {id === "new" ? "New briefing" : "Edit briefing"}
      </h1>
      <ArticleEditor initial={initial} />
    </div>
  );
}
