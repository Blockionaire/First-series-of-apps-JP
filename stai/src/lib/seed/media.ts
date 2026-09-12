import type { SeedPodcast, SeedResearch, SeedSignal } from "./types";

/**
 * Podcast episodes.
 *
 * Deliberately empty. The previous entries named guests — academics at real
 * universities, a "former AFM supervision officer" — who do not exist, for
 * episodes that were never recorded. Attributing views to invented people at
 * real institutions is not a placeholder problem, it is a fabrication problem.
 * Add entries only when a real episode exists with a real, consenting guest.
 */
export const podcasts: SeedPodcast[] = [];

/**
 * Research desk.
 *
 * Deliberately empty. The previous entries were invented papers with invented
 * authors, attributed to REAL journals (The Accounting Review, European
 * Accounting Review, and others). Fabricated citations are the single most
 * damaging thing this publication could put in front of auditors. Add entries
 * only for papers that exist and have been read.
 */
export const research: SeedResearch[] = [];

/**
 * Ticker signals.
 *
 * Only milestones that are verifiable in the Act's own published text. The
 * previous list mixed these with invented enforcement actions ("ESMA issues
 * first model-governance fine — EUR 2.4m", "AFM opens thematic review of all
 * six OOB firms") presented as live regulatory news. Practitioners act on
 * news. Nothing goes in here that cannot be checked against a primary source.
 */
export const signals: SeedSignal[] = [
  { label: "EU AI Act — GPAI & high-risk obligations enforceable 02 AUG 2026", detail: "Art. 113 application schedule", kind: "reg", publishedAt: "2026-08-02" },
  { label: "EU AI Act — prohibited practices and AI-literacy duty in force since 02 FEB 2025", detail: "Art. 5 and Art. 4", kind: "reg", publishedAt: "2025-02-02" },
  { label: "EU AI Act — GPAI model obligations in force since 02 AUG 2025", detail: "penalties regime and national authorities", kind: "reg", publishedAt: "2025-08-02" },
  { label: "EU AI Act — Annex I high-risk and legacy GPAI deadline 02 AUG 2027", detail: "Art. 113 final phase", kind: "reg", publishedAt: "2027-08-02" },
];
