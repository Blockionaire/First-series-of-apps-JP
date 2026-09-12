import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AUTHORS, authorBySlug } from "@/lib/authors";
import { allArticles } from "@/lib/content";
import { pageMeta, abs, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { fmtDate } from "@/lib/format";
import { PlusBadge } from "@/components/Logo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return AUTHORS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = authorBySlug(slug);
  if (!a) return {};
  return pageMeta({
    title: `${a.name} — ${a.role}`,
    description: `${a.name} — the editorial desk behind STAI analysis of ${a.beats.slice(0, 3).join(", ").toLowerCase()} for European audit and finance professionals.`,
    path: `/authors/${a.slug}`,
  });
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = authorBySlug(slug);
  if (!author) notFound();

  const pieces = allArticles().filter((a) => a.author === author.name);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            url: abs(`/authors/${author.slug}`),
            mainEntity: {
              "@type": "Organization",
              "@id": abs(`/authors/${author.slug}#desk`),
              name: author.name,
              description: author.bio,
              url: abs(`/authors/${author.slug}`),
              knowsAbout: author.beats,
              parentOrganization: { "@id": abs("/#organization") },
            },
          },
          breadcrumbSchema([
            { name: "STAI", path: "/" },
            { name: "Authors", path: `/authors/${author.slug}` },
            { name: author.name, path: `/authors/${author.slug}` },
          ]),
        ]}
      />

      <header className="border-b pb-8 rule">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          {author.role}
        </p>
        <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-5xl">{author.name}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          {author.bio}
        </p>

        {/* Disclosure replaces the credentials list. We state what this byline
            is and what it is not, rather than asserting qualifications. */}
        <div className="mt-6 border p-5 rule">
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            What this byline means
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            {author.disclosure}
          </p>
        </div>

        <div className="mt-6">
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Subjects covered
          </p>
          <p className="f-mono mt-2 text-[0.72rem] leading-relaxed tracking-[0.04em] text-cream-400">
            {author.beats.join(" · ")}
          </p>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="f-label" style={{ color: "var(--ink-faint)" }}>
          {pieces.length} {pieces.length === 1 ? "piece" : "pieces"} on the desk
        </h2>
        <ol className="mt-3">
          {pieces.map((a, i) => (
            <li key={a.id} className="border-t rule last:border-b">
              <Link href={`/briefing/${a.slug}`} className="group grid gap-x-6 gap-y-1 py-5 sm:grid-cols-[4rem_1fr] sm:items-baseline">
                <span className="index-num">{String(i + 1).padStart(2, "0")} /</span>
                <span>
                  <span className="f-display-wide block text-lg text-cream-100 transition-colors group-hover:text-white sm:text-xl">
                    {a.title}
                    {a.premium && (
                      <span className="ml-3 align-middle">
                        <PlusBadge />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    {a.dek}
                  </span>
                  <span className="f-mono mt-2 block text-[0.62rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {a.category} · <time dateTime={a.published_at}>{fmtDate(a.published_at)}</time> · {a.reading_min} min
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 border-t pt-6 rule">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Keep reading
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/briefing" className="btn btn-ghost">
            The full Briefing
          </Link>
          <Link href="/ai-act" className="btn btn-ghost">
            EU AI Act tracker
          </Link>
        </div>
      </section>
    </div>
  );
}
