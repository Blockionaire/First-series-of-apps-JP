import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { promptBySlug, allPrompts } from "@/lib/content";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import CopyButton from "@/components/CopyButton";
import BookmarkButton from "@/components/BookmarkButton";
import AdaptPanel from "@/components/prompts/AdaptPanel";
import { PlusBadge } from "@/components/Logo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = promptBySlug(slug);
  if (!p) return {};
  return { title: `${p.title} — Prompt Library`, description: p.description };
}

export default async function PromptPage({ params }: Props) {
  const { slug } = await params;
  const prompt = promptBySlug(slug);
  if (!prompt) notFound();

  const user = await currentUser();
  const isPlus = user?.plan === "plus";
  const lockedBody = prompt.premium && !isPlus;
  // Server-side cut: locked prompt bodies never reach the client.
  const visibleBody = lockedBody ? prompt.body.slice(0, 260) + "\n\n[…]" : prompt.body;

  const bookmarked = user
    ? !!db()
        .prepare("SELECT 1 FROM bookmarks WHERE user_id=? AND kind='prompt' AND ref_id=?")
        .get(user.id, prompt.id)
    : false;

  const siblings = allPrompts()
    .filter((p) => p.category === prompt.category && p.id !== prompt.id)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <p className="f-mono text-[0.68rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-faint)" }}>
          <Link href="/prompts" className="hover:text-cream-100">
            Prompt Library
          </Link>{" "}
          / {prompt.category}
          {prompt.premium && (
            <span className="ml-3 align-middle">
              <PlusBadge />
            </span>
          )}
        </p>
        <h1 className="f-display mt-3 text-3xl text-cream-100 sm:text-5xl">{prompt.title}</h1>
        <p className="mt-3 max-w-2xl leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          {prompt.description}
        </p>
        <div className="f-mono mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.65rem] tracking-[0.08em] uppercase" style={{ color: "var(--ink-faint)" }}>
          <span>Ref STAI-PL-{String(prompt.id).padStart(3, "0")}</span>
          {prompt.uses > 0 && <span>{prompt.uses} uses this quarter</span>}
          <span>{prompt.variables.length} variables</span>
        </div>
      </header>

      {/* the prompt */}
      <section className="mt-8 border rule-strong">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 rule">
          <p className="f-label" style={{ color: "var(--ink-muted)" }}>
            The prompt {lockedBody && "— preview"}
          </p>
          {!lockedBody && (
            <div className="flex gap-2">
              <CopyButton text={prompt.body} />
              <BookmarkButton kind="prompt" refId={prompt.id} initial={bookmarked} authed={!!user} />
            </div>
          )}
        </div>
        <div className={lockedBody ? "veil" : undefined}>
          <pre className="panel-scroll max-h-[34rem] overflow-auto bg-navy-950 p-5 text-[0.82rem] leading-relaxed whitespace-pre-wrap f-mono text-cream-200">
            {visibleBody}
          </pre>
        </div>
        {lockedBody && (
          <div className="border-t px-5 py-5" style={{ borderColor: "var(--gold-line)" }}>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              The full prompt — {prompt.body.split(/\s+/).length} words with {prompt.variables.length} engagement
              variables and its guardrail set — is part of the STAI+ library.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/plus" className="btn btn-plus premium-focus">
                Unlock with STAI+
              </Link>
              {!user && (
                <Link href={`/login?next=/prompts/${prompt.slug}`} className="btn btn-ghost">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* variables + usage note */}
      {!lockedBody && (
        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="border p-5 rule">
            <p className="f-label" style={{ color: "var(--ink-faint)" }}>
              Variables to fill
            </p>
            <ul className="mt-3 space-y-2">
              {prompt.variables.map((v) => (
                <li key={v} className="f-mono text-[0.78rem] text-cream-200">
                  <span className="text-cream-400">{"{{"}</span>
                  {v}
                  <span className="text-cream-400">{"}}"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border p-5 rule">
            <p className="f-label" style={{ color: "var(--ink-faint)" }}>
              Model & filing notes
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              {prompt.model_note}
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              If the output influences an audit conclusion, file the prompt and model version with it —{" "}
              <Link href="/briefing/prompt-is-the-new-working-paper" className="text-cream-100 underline underline-offset-4">
                the prompt is the working paper
              </Link>
              .
            </p>
          </div>
        </section>
      )}

      {/* adapt */}
      <div className="mt-6">
        <AdaptPanel slug={prompt.slug} promptTitle={prompt.title} locked={!isPlus} authed={!!user} />
      </div>

      {/* siblings */}
      {siblings.length > 0 && (
        <section className="mt-12">
          <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
            More in {prompt.category}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/prompts/${s.slug}`}
                className="group border p-4 transition-colors rule hover:border-[var(--line-strong)]"
              >
                <div className="flex items-center justify-between">
                  <span className="f-mono text-[0.6rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {s.premium ? "STAI+" : "Free"}
                  </span>
                  {s.premium && <PlusBadge />}
                </div>
                <p className="f-display-wide mt-2 text-base text-cream-100 group-hover:text-white">{s.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
