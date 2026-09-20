import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { SITE } from "@/lib/seo";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = `STAI — ${SITE.tagline}`;

export default function Image() {
  return ogCard({
    eyebrow: "The intelligence platform for European audit",
    title: "AI is rewriting the audit. Stay the one who checks.",
    meta: "stai-ahead.com — briefings, prompts, Ask STAI",
  });
}
