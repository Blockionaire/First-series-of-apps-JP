import { articleBySlug } from "@/lib/content";
import { fmtDate } from "@/lib/format";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "STAI briefing";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);

  if (!a) {
    return ogCard({ eyebrow: "The Briefing", title: "STAI", meta: "stai.ai" });
  }

  return ogCard({
    eyebrow: a.category,
    title: a.title,
    meta: `${a.author} · ${fmtDate(a.published_at)} · ${a.reading_min} min read`,
    premium: a.premium,
  });
}
