import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { promptCategories, blankPrompt } from "@/lib/admin/prompts";
import PromptEditor from "@/components/admin/PromptEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "New prompt — admin",
  description: "STAI prompt library editor.",
  path: "/admin/prompts",
  noIndex: true,
});

export default async function NewPromptPage() {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/prompts/new");

  const categories = promptCategories();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        <Link href="/admin/prompts" className="hover:text-cream-100">
          Prompt library
        </Link>{" "}
        / new
      </p>
      <h1 className="f-display mt-2 text-3xl text-cream-100">New prompt</h1>
      <p className="mt-2 mb-8 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
        Starts as a draft, so nothing reaches readers until you publish it deliberately.
      </p>
      {/* A new prompt starts in whatever shelf is first alphabetically, which
          is only a starting point — the field accepts any category. */}
      <PromptEditor initial={blankPrompt(categories[0] ?? "")} categories={categories} />
    </div>
  );
}
