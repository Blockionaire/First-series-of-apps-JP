import type { Metadata } from "next";
import Link from "next/link";
import { allPrompts } from "@/lib/content";
import { currentUser } from "@/lib/auth";
import PromptExplorer from "@/components/prompts/PromptExplorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Prompt Library",
  description:
    "Vetted, guardrailed AI prompts for real audit, tax and finance work — risk assessment, memos, CSRD, ISA research, analytics.",
};

export default async function PromptsPage() {
  const user = await currentUser();
  const isPlus = user?.plan === "plus";
  const prompts = allPrompts();
  const freeCount = prompts.filter((p) => !p.premium).length;

  const cards = prompts.map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category,
    description: p.description,
    premium: p.premium,
    uses: p.uses,
    variables: p.variables.length,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Intelligence desk / 02
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">The Prompt Library</h1>
          <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
            {prompts.length} prompts written like methodology, not magic tricks: scoped tasks, hard guardrails,
            file-ready output. {freeCount} are open to everyone; the full canon — and adapt-with-AI — is STAI+.
          </p>
        </div>
        {!isPlus && (
          <Link href="/plus" className="btn btn-plus-ghost premium-focus shrink-0">
            Unlock the full library
          </Link>
        )}
      </header>
      <PromptExplorer items={cards} isPlus={isPlus} />
    </div>
  );
}
