/**
 * Author entities. Bylines link here and the pages emit Person structured
 * data — for professional advisory content, a named, credentialed author
 * with a stable URL is the E-E-A-T signal search engines weigh most.
 */

export type Author = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  credentials: string[];
  beats: string[];
};

export const AUTHORS: Author[] = [
  {
    slug: "marieke-van-dijk",
    name: "Marieke van Dijk",
    role: "Editor, STAI",
    bio: "Marieke edits STAI. She spent eleven years in statutory audit — the last four as a quality partner at a Dutch mid-tier firm, where she owned the methodology response to ISQM 1 — before turning to writing about the profession full time. She covers the collision between AI governance and the standards framework, and takes the view that most of what firms need already exists in the standards they have.",
    credentials: ["RA (Registeraccountant)", "Former quality partner, Dutch mid-tier", "ISQM 1 implementation lead"],
    beats: ["EU AI Act", "ISQM 1", "Documentation & ISA 230", "Professional scepticism"],
  },
  {
    slug: "jonas-keller",
    name: "Jonas Keller",
    role: "Contributing Analyst",
    bio: "Jonas writes STAI's analytical desk pieces, translating regulation and model risk into the currency audit actually runs on: materiality. A former financial-services risk modeller who moved into audit advisory, he is the person to send the partner who says model risk cannot be quantified.",
    credentials: ["MSc Quantitative Finance", "Former FS risk modelling, Frankfurt", "Audit advisory — model governance"],
    beats: ["Model risk", "Materiality", "Fraud & evidence", "Market strategy"],
  },
  {
    slug: "sofia-lindqvist",
    name: "Sofia Lindqvist",
    role: "Senior Correspondent",
    bio: "Sofia reports on sustainability assurance and the supervisory landscape across the Nordics, Benelux and DACH. She has covered every CSRD assurance cycle since the first, and her reporting on the divergence between Dutch and German supervisory practice is cited inside more than one methodology team.",
    credentials: ["Sustainability assurance specialist", "Nordic & DACH supervisory beat", "Former ESG assurance senior"],
    beats: ["CSRD & ESRS", "Supervision", "Analytics", "Jurisdictional divergence"],
  },
  {
    slug: "tom-verhagen",
    name: "Tom Verhagen",
    role: "Practice Editor",
    bio: "Tom runs STAI's field research — the reporting that follows real firms through real deployments and publishes the numbers, including the unflattering ones. He designed the adoption telemetry behind our Copilot field reports and is unusually hard to sell to.",
    credentials: ["Practice research lead", "Firm adoption telemetry design", "Former audit senior manager"],
    beats: ["Adoption & tooling", "Procurement", "Training & talent", "Field research"],
  },
  {
    slug: "stai-desk",
    name: "STAI Desk",
    role: "Newsroom",
    bio: "The STAI newsroom: fast, sourced reporting on regulatory and standard-setting moves affecting European audit and finance. Desk pieces are written collectively and edited by Marieke van Dijk.",
    credentials: ["Collective newsroom byline", "Edited by the Editor, STAI"],
    beats: ["Breaking regulation", "Standard-setting", "Enforcement"],
  },
];

export function authorSlug(name: string): string {
  const found = AUTHORS.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (found) return found.slug;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function authorBySlug(slug: string): Author | null {
  return AUTHORS.find((a) => a.slug === slug) ?? null;
}
