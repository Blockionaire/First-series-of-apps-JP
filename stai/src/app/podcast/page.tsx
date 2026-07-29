import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { allPodcasts } from "@/lib/content";
import { fmtDate } from "@/lib/format";
import JsonLd from "@/components/JsonLd";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "The STAI Podcast",
  description: "Conversations with the regulators, researchers and practitioners shaping AI in the European audit profession.",
  path: "/podcast",
});

/** Deterministic decorative waveform per episode — no assets, no randomness across renders. */
function bars(slug: string): number[] {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < 56; i++) {
    h ^= slug.charCodeAt(i % slug.length) + i;
    h = Math.imul(h, 16777619);
    out.push(0.25 + ((h >>> 8) % 1000) / 1350);
  }
  return out;
}

export default function PodcastPage() {
  const episodes = allPodcasts();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "PodcastSeries",
          name: "The STAI Podcast",
          url: abs("/podcast"),
          description:
            "Conversations with the regulators, researchers and practitioners shaping AI in the European audit profession.",
          publisher: { "@id": abs("/#organization") },
          inLanguage: "en-GB",
          hasPart: episodes.map((ep) => ({
            "@type": "PodcastEpisode",
            episodeNumber: ep.episode_no,
            name: ep.title,
            description: ep.description,
            datePublished: ep.published_at,
            timeRequired: `PT${ep.duration_min}M`,
            url: abs(`/podcast#${ep.slug}`),
          })),
        }}
      />
      <header className="mb-10">
        <p className="f-label" style={{ color: "var(--ink-faint)" }}>
          Intelligence desk / 04
        </p>
        <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-6xl">The STAI Podcast</h1>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--ink-muted)" }}>
          The people shaping AI in the European profession — regulators, researchers, quality partners — in
          conversations long enough to get past the talking points.
        </p>
        <p className="f-mono mt-4 text-[0.68rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
          Also on Spotify · Apple Podcasts · RSS
        </p>
      </header>

      <ol className="space-y-0">
        {episodes.map((ep) => (
          <li key={ep.id} id={ep.slug} className="scroll-mt-28 border-t rule last:border-b">
            <details className="group">
              <summary className="grid cursor-pointer list-none gap-x-6 gap-y-2 py-6 sm:grid-cols-[5rem_1fr_auto] sm:items-center [&::-webkit-details-marker]:hidden">
                <span className="f-mono text-2xl font-bold tabular-nums" style={{ color: "var(--ink-faint)" }}>
                  {String(ep.episode_no).padStart(2, "0")}
                </span>
                <span>
                  <span className="f-display-wide block text-xl text-cream-100 sm:text-2xl">{ep.title}</span>
                  <span className="f-mono mt-1 block text-[0.65rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {ep.guest} · {fmtDate(ep.published_at)} · {ep.duration_min} min
                  </span>
                </span>
                <span
                  className="f-mono hidden border px-3 py-2 text-[0.65rem] tracking-[0.14em] uppercase rule-strong text-cream-400 transition-colors group-open:bg-cream-200 group-open:text-navy-900 sm:block"
                  aria-hidden
                >
                  <span className="group-open:hidden">Notes +</span>
                  <span className="hidden group-open:inline">Close −</span>
                </span>
              </summary>
              <div className="pb-8 sm:pl-[6.5rem]">
                <div className="flex h-10 items-end gap-[2px]" aria-hidden="true">
                  {bars(ep.slug).map((b, i) => (
                    <span key={i} className="w-1 bg-cream-400/40" style={{ height: `${b * 100}%` }} />
                  ))}
                </div>
                <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {ep.description}
                </p>
                <p className="f-mono mt-4 text-[0.65rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
                  Listen on Spotify / Apple Podcasts — search “STAI”
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
