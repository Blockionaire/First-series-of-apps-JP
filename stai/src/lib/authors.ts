/**
 * Author identity.
 *
 * STAI publishes under a single transparent editorial byline. There are no
 * named personas, no biographies, no qualifications and no employment history,
 * because none of that could be stated truthfully yet — and fabricating
 * credentials for an audience of auditors would destroy the one asset this
 * publication cannot rebuild.
 *
 * When real named contributors join, add them here with only facts they have
 * confirmed about themselves.
 */

export type Author = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  /** Honest statement of what this byline is. No credentials. */
  disclosure: string;
  beats: string[];
};

export const EDITORIAL_SLUG = "stai-editorial";

export const AUTHORS: Author[] = [
  {
    slug: EDITORIAL_SLUG,
    name: "STAI Editorial",
    role: "Editorial desk",
    bio: "STAI Editorial is the collective byline for everything published on this desk. Pieces are written and edited in-house, and cover the regulation, standards and practice questions facing audit, accountancy and finance professionals in Europe.",
    disclosure:
      "Articles under this byline are editorial analysis of publicly available regulation, standards and guidance. They are not reported interviews, and they do not present original field research. Where a piece draws on a specific rule or publication, that source is named in the text so you can check it yourself. Nothing here is professional advice; engagement-level judgement remains with the practitioner.",
    beats: ["EU AI Act", "ISQM 1", "Audit standards", "CSRD assurance", "AI tooling in practice"],
  },
];

export function authorSlug(name: string): string {
  const found = AUTHORS.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (found) return found.slug;
  // Everything published today carries the editorial byline.
  return EDITORIAL_SLUG;
}

export function authorBySlug(slug: string): Author | null {
  return AUTHORS.find((a) => a.slug === slug) ?? null;
}
