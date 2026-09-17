export const CATEGORIES = ["Regulation", "Analysis", "Practice", "Tools", "News"] as const;
export type Category = (typeof CATEGORIES)[number];

export function categorySlug(c: string): string {
  return c.toLowerCase();
}

export function categoryFromSlug(slug: string): Category | null {
  return CATEGORIES.find((c) => c.toLowerCase() === slug.toLowerCase()) ?? null;
}

/** Search-facing copy per category: these pages are landing pages, not filters. */
export const CATEGORY_COPY: Record<Category, { blurb: string; seoTitle: string; seoDescription: string }> = {
  Regulation: {
    blurb:
      "The EU AI Act, NIS2, DORA and the supervisory practice forming around them — read for what actually lands in the audit file, and by when.",
    seoTitle: "AI regulation for auditors — EU AI Act, DORA, NIS2",
    seoDescription:
      "Analysis of the EU AI Act, DORA and NIS2 for European audit and finance professionals: deployer obligations, supervisory expectations, and what changes before the August 2026 enforcement date.",
  },
  Analysis: {
    blurb:
      "Longer-form argument: where the profession's assumptions are quietly breaking, and what replaces them. Evidence hierarchies, model risk, scepticism as system design.",
    seoTitle: "Analysis — AI, evidence and audit judgement",
    seoDescription:
      "In-depth analysis of how AI reshapes audit evidence, professional scepticism, model risk and materiality — written for partners, quality leads and senior practitioners in Europe.",
  },
  Practice: {
    blurb:
      "How firms are actually doing it: field reports with real adoption numbers, CSRD assurance workflows, quality-management machinery, and the talent question nobody has solved.",
    seoTitle: "AI in audit practice — field reports and workflows",
    seoDescription:
      "Field research on AI adoption in European audit firms: Copilot deployment data, CSRD assurance workflows, ISQM 1 governance, and training the associates automation didn't replace.",
  },
  Tools: {
    blurb:
      "Tooling assessed the way an auditor should assess anything: what it does, how it fails, what it leaves in the file, and which vendor answers should end the meeting.",
    seoTitle: "Audit AI tools — assessment, procurement, journal testing",
    seoDescription:
      "Independent assessment of AI tooling for audit: vendor due diligence, journal entry testing with LLMs, documentation requirements, and where the tools genuinely fail.",
  },
  News: {
    blurb:
      "Fast, sourced reporting on the regulatory and standard-setting moves that change what you have to do next quarter.",
    seoTitle: "News — AI regulation and standards for audit",
    seoDescription:
      "Breaking coverage of regulatory and standard-setting developments affecting European audit: AFM reviews, IAASB consultations, ESMA enforcement and EU AI Act implementation.",
  },
};
