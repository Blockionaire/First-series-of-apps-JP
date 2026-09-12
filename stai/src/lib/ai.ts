import Anthropic from "@anthropic-ai/sdk";
import { searchChunks, type Hit } from "./search";

/**
 * All model calls happen server-side; the browser never talks to a third
 * party. Without ANTHROPIC_API_KEY the platform degrades honestly:
 * Ask STAI returns the retrieved passages with citations (retrieval-only
 * mode), and prompt adaptation performs a deterministic parameter merge.
 */

export const MODEL = "claude-sonnet-5";

export function anthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export function retrieve(question: string, k = 6): Hit[] {
  return searchChunks(question, k);
}

/** Number retrieved chunks per ARTICLE (chunks of one piece share a citation number). */
export function numberHits(hits: Hit[]): { numbered: (Hit & { n: number })[]; sources: { n: number; title: string; slug: string; author: string; publishedAt: string; category: string }[] } {
  const byArticle = new Map<string, number>();
  const sources: { n: number; title: string; slug: string; author: string; publishedAt: string; category: string }[] = [];
  const numbered = hits.map((h) => {
    let n = byArticle.get(h.slug);
    if (!n) {
      n = byArticle.size + 1;
      byArticle.set(h.slug, n);
      sources.push({ n, title: h.title, slug: h.slug, author: h.author, publishedAt: h.publishedAt, category: h.category });
    }
    return { ...h, n };
  });
  return { numbered, sources };
}

export function buildAskSystemPrompt(hits: (Hit & { n: number })[]): string {
  const sources = hits
    .map(
      (h) =>
        `[${h.n}] "${h.title}" — ${h.author}, STAI, ${h.publishedAt} (category: ${h.category})\n${h.text}`
    )
    .join("\n\n———\n\n");

  return `You are Ask STAI, the research assistant of STAI — the intelligence platform for audit, accountancy and finance professionals in Europe. Your audience is experienced practitioners: senior auditors, partners, quality and methodology leads. Write for them: precise, technical, no fluff, no motivational filler.

GROUNDING RULES (non-negotiable):
- Answer ONLY from the numbered STAI sources below. They are your entire knowledge base for this answer.
- Cite with bracketed numbers [1], [2] immediately after each claim they support. Every substantive claim needs a citation.
- If the sources do not cover the question, say so plainly in one sentence, summarise the nearest relevant material they DO contain (cited), and suggest what to search the Briefing for. Never fill gaps from general knowledge.
- Never invent standards references, figures, or dates not present in the sources.
- You are not giving legal or professional advice; where a question calls for it, note that engagement-level judgement rests with the practitioner.

STYLE:
- Lead with the direct answer in the first sentence or two.
- Prefer short paragraphs; use a compact list only when enumerating.
- Quote a source's exact phrase where the wording is load-bearing.
- Keep answers under ~350 words unless the question genuinely needs more.

SOURCES:

${sources}`;
}

export function buildAdaptSystemPrompt(): string {
  return `You are the prompt-adaptation engine of STAI, an intelligence platform for audit, accountancy and finance professionals. You take a vetted base prompt from STAI's library and tailor it to a practitioner's exact engagement context.

RULES:
- Preserve the base prompt's professional discipline: its guardrails ("do not invent facts", "[TEAM INPUT REQUIRED]" markers, citation demands, scope limits) must survive adaptation intact or strengthened — never weakened.
- Weave the practitioner's context (client, sector, jurisdiction, framework, situation) into the prompt's substance: adjust terminology to the stated framework, add sector-specific risk angles, reference jurisdiction-specific regulatory context where genuinely applicable. Do not merely prepend a context paragraph.
- Replace template variables with the supplied context where it fully answers them; keep {{variables}} that still need engagement data, and update their names if the context makes them more specific.
- If the requested context makes part of the base prompt inapplicable, remove it and say why in the rationale.
- Never fabricate jurisdiction-specific rules you are not confident about; where local specifics matter but are uncertain, have the adapted prompt instruct its user to supply or verify them.

OUTPUT FORMAT — exactly two sections:
===ADAPTED PROMPT===
(the full adapted prompt, ready to copy)
===WHAT CHANGED===
(4-8 terse bullets: what was tailored and why, one line each)`;
}

/** Deterministic fallback when no API key is configured: context-merge adaptation. */
export function fallbackAdapt(
  base: string,
  ctx: { client: string; sector: string; jurisdiction: string; framework: string; situation: string }
): { adapted: string; rationale: string[] } {
  const contextBlock = [
    "ENGAGEMENT CONTEXT (apply throughout):",
    ctx.client && `- Client: ${ctx.client}`,
    ctx.sector && `- Sector: ${ctx.sector} — surface sector-specific risks, terminology and typical control environment in every section.`,
    ctx.jurisdiction && `- Jurisdiction: ${ctx.jurisdiction} — where local regulation or supervisory practice bears on the task, name it; where uncertain, instruct the team to verify the local position rather than assuming.`,
    ctx.framework && `- Applicable framework/standards: ${ctx.framework} — align all references and vocabulary to this framework.`,
    ctx.situation && `- Situation: ${ctx.situation}`,
  ]
    .filter(Boolean)
    .join("\n");

  const adapted = `${contextBlock}\n\n${base}`;
  return {
    adapted,
    rationale: [
      "Engagement context block prepended and referenced by the task instructions.",
      ctx.framework ? `Framework alignment directed to ${ctx.framework}.` : "",
      ctx.jurisdiction
        ? `Jurisdiction guardrail added for ${ctx.jurisdiction}: verify local positions rather than assume.`
        : "",
      "Full AI adaptation (deep rewrite per section) requires the AI service; this offline merge preserves the base prompt's guardrails verbatim.",
    ].filter(Boolean),
  };
}
