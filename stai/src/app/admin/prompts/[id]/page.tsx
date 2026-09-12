import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { adminPromptById, promptCategories, type EditorPrompt } from "@/lib/admin/prompts";
import PromptEditor from "@/components/admin/PromptEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Edit prompt — admin",
  description: "STAI prompt library editor.",
  path: "/admin/prompts",
  noIndex: true,
});

export default async function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/prompts");

  const { id } = await params;
  // /admin/prompts/new has its own route; anything else here must be an id.
  if (id === "new") redirect("/admin/prompts/new");

  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) notFound();

  const row = adminPromptById(numeric);
  if (!row) notFound();

  let variables: string[] = [];
  try {
    variables = JSON.parse(row.variables) as string[];
  } catch {
    variables = [];
  }

  const initial: EditorPrompt = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    description: row.description,
    body: row.body,
    variables: variables.join(", "),
    model_note: row.model_note,
    premium: !!row.premium,
    status: row.status,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        <Link href="/admin/prompts" className="hover:text-cream-100">
          Prompt library
        </Link>{" "}
        / #{row.id}
      </p>
      <h1 className="f-display mt-2 text-3xl text-cream-100">Edit prompt</h1>
      <p className="f-mono mt-2 mb-8 text-[0.68rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
        {row.uses} adaptations run
        {row.updated_at ? ` · last edited ${row.updated_at.slice(0, 16)}` : " · never edited here"}
      </p>
      <PromptEditor initial={initial} categories={promptCategories()} />
    </div>
  );
}
