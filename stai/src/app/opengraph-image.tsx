import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "STAI — Signal & training for audit intelligence";

export default function Image() {
  return ogCard({
    eyebrow: "The intelligence platform for European audit",
    title: "AI is rewriting the audit. Stay the one who checks.",
    meta: "stai.ai — briefings, prompts, Ask STAI",
  });
}
