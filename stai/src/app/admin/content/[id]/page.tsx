import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import ArticleEditor, { type EditorArticle } from "@/components/admin/ArticleEditor";

export const dynamic = "force-dynamic";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = db().prepare("SELECT * FROM articles WHERE id=?").get(Number(id)) as any;
    if (!row) notFound();
    initial = {
      ...row,
      premium: !!row.premium,
      tags: (JSON.parse(row.tags) as string[]).join(", "),
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
