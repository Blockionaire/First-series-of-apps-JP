/**
 * The proposed source registry — 51 publications, none of them active.
 *
 * ── Read this before approving anything ─────────────────────────────────
 *
 * This is a PROPOSAL. Loading it into the database creates 51 dormant rows
 * (`active = 0`) and starts exactly zero crawls. Each row is activated by hand
 * in /admin/editorial/sources, after a person has checked three things:
 *
 *   1. the tier is right — a Tier-1 row's claims carry weight a Tier-2 row's
 *      do not, and that is the whole reason tiers exist;
 *   2. `fetch_allowed` — whether that site's robots.txt and terms actually
 *      permit automated retrieval. Every row below ships with it FALSE,
 *      because nobody has checked yet and assuming permission is how a
 *      publisher's first contact with STAI becomes a complaint;
 *   3. the feed URL still resolves.
 *
 * ── Honesty about the feed URLs ─────────────────────────────────────────
 *
 * `feed_url` values are the conventional, documented feed location for each
 * publication. They have NOT been fetched — this container cannot reach the
 * open internet — so they are a starting point for verification, not a
 * verified list. Anything that 404s on first fetch will surface immediately
 * as `never_fetched` health, which is why that state exists.
 *
 * Several standard setters publish nothing machine-readable at all. Those are
 * marked `html_scrape` and are the fragile ones: a redesign breaks them
 * silently, which is what the `3 × fetch_frequency` silence check in
 * lib/newsroom/sources.ts is for.
 *
 * ── Composition ─────────────────────────────────────────────────────────
 *
 * Tier 1: 27 · Tier 2: 20 · Tier 3: 4
 *
 * Deliberately heavy at Tier 1. The engine's binding constraint is not "can it
 * find news" — an hour of any tech feed produces more than a desk can use.
 * It is "can it reach the primary text", because masterplan §8 will not let a
 * regulatory piece reach review without one.
 *
 * European-first and country-aware, per decision D7. The US and APAC entries
 * are absent on purpose: they are taggable if a story genuinely touches them,
 * but nothing is being crawled for them.
 */

import type { SourceCreate } from "./store.ts";
import { DEFAULT_FREQUENCY, DEFAULT_RETENTION, type Tier } from "./sources.ts";

type Proposed = {
  name: string;
  domain: string;
  source_type: SourceCreate["source_type"];
  authority_tier: Tier;
  jurisdictions: string[];
  topics: string[];
  ingestion_method: SourceCreate["ingestion_method"];
  feed_url: string;
  license_notes?: string;
  /** Why this one is on the list at all. Shown in the approval screen. */
  rationale: string;
};

export const PROPOSED_SOURCES: Proposed[] = [
  // ─── Tier 1 · EU institutions and supervisors ──────────────────────────
  {
    name: "European Commission — press corner",
    domain: "ec.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["regulation", "ai", "reporting"],
    ingestion_method: "rss",
    feed_url: "https://ec.europa.eu/commission/presscorner/api/rss",
    rationale: "Where AI Act implementing acts, CSRD amendments and delegated regulations are announced first.",
  },
  {
    name: "EUR-Lex — Official Journal, L series",
    domain: "eur-lex.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["regulation", "legislation"],
    ingestion_method: "rss",
    feed_url: "https://eur-lex.europa.eu/EN/display-feed.rss",
    license_notes: "EU legal texts are reusable under the Commission's reuse decision; attribution required.",
    rationale: "The legal text itself. This is the source a regulatory claim ultimately has to resolve to.",
  },
  {
    name: "European AI Office",
    domain: "digital-strategy.ec.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["ai", "regulation"],
    ingestion_method: "html_scrape",
    feed_url: "https://digital-strategy.ec.europa.eu/en/policies/ai-office",
    rationale: "Guidance and codes of practice under the AI Act. No usable feed — needs scraping.",
  },
  {
    name: "ESMA",
    domain: "esma.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["reporting", "enforcement", "markets"],
    ingestion_method: "rss",
    feed_url: "https://www.esma.europa.eu/rss.xml",
    rationale: "Enforcement priorities for financial reporting, and the annual common enforcement priorities statement.",
  },
  {
    name: "EBA",
    domain: "eba.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["banking", "regulation", "ai"],
    ingestion_method: "rss",
    feed_url: "https://www.eba.europa.eu/rss.xml",
    rationale: "Bank supervision, ICT risk and the DORA perimeter — directly relevant to financial-sector audit.",
  },
  {
    name: "EIOPA",
    domain: "eiopa.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["insurance", "regulation"],
    ingestion_method: "rss",
    feed_url: "https://www.eiopa.europa.eu/rss.xml",
    rationale: "Insurance supervision, including its AI governance work.",
  },
  {
    name: "CEAOB",
    domain: "finance.ec.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["audit", "oversight"],
    ingestion_method: "html_scrape",
    feed_url: "https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/financial-markets/auditing_en",
    rationale: "The committee of European audit oversight bodies. Low volume, high relevance.",
  },
  {
    name: "EDPB",
    domain: "edpb.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["data", "privacy", "ai"],
    ingestion_method: "rss",
    feed_url: "https://www.edpb.europa.eu/feed_en",
    rationale: "GDPR opinions on AI processing — the constraint most often missed when firms deploy tooling.",
  },
  {
    name: "ENISA",
    domain: "enisa.europa.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["cybersecurity", "data"],
    ingestion_method: "rss",
    feed_url: "https://www.enisa.europa.eu/media/news-items/news-wires/RSS",
    rationale: "NIS2 and cyber guidance that lands in IT-audit scope.",
  },

  // ─── Tier 1 · Standard setters ─────────────────────────────────────────
  {
    name: "IAASB",
    domain: "iaasb.org",
    source_type: "standard_setter",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["audit", "standards", "assurance"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.iaasb.org/news-events",
    rationale: "ISA and ISQM pronouncements. The primary source for any auditing-standards claim.",
  },
  {
    name: "IESBA",
    domain: "ethicsboard.org",
    source_type: "standard_setter",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["ethics", "independence", "standards"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.ethicsboard.org/news-events",
    rationale: "The ethics code, including its recent work on technology and independence.",
  },
  {
    name: "IFRS Foundation",
    domain: "ifrs.org",
    source_type: "standard_setter",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["accounting", "standards", "sustainability"],
    ingestion_method: "rss",
    feed_url: "https://www.ifrs.org/rss/news/",
    rationale: "IFRS and ISSB. Primary text for accounting and sustainability-reporting claims.",
  },
  {
    name: "EFRAG",
    domain: "efrag.org",
    source_type: "standard_setter",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["reporting", "sustainability", "esrs"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.efrag.org/en/news-and-calendar",
    rationale: "ESRS development and the CSRD technical advice. No reliable feed.",
  },
  {
    name: "IFAC",
    domain: "ifac.org",
    source_type: "professional_body",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["profession", "audit", "standards"],
    ingestion_method: "rss",
    feed_url: "https://www.ifac.org/rss/knowledge-gateway",
    rationale: "Profession-wide guidance and the gateway commentary on standards adoption.",
  },
  {
    name: "IIA — Institute of Internal Auditors",
    domain: "theiia.org",
    source_type: "professional_body",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["internal audit", "standards"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.theiia.org/en/content/news/",
    rationale: "The Global Internal Audit Standards, and the internal-audit half of the audience.",
  },
  {
    name: "COSO",
    domain: "coso.org",
    source_type: "standard_setter",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["internal control", "risk"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.coso.org/guidance",
    rationale: "The control framework every ICFR conversation rests on, including its AI guidance.",
  },
  {
    name: "NIST",
    domain: "nist.gov",
    source_type: "standard_setter",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "risk", "cybersecurity"],
    ingestion_method: "rss",
    feed_url: "https://www.nist.gov/news-events/news/rss.xml",
    rationale: "The AI Risk Management Framework, which European firms use as the practical scaffold.",
  },
  {
    name: "ISO",
    domain: "iso.org",
    source_type: "standard_setter",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "standards", "management systems"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.iso.org/news.html",
    rationale: "ISO/IEC 42001 certification is becoming the thing firms are asked to evidence.",
  },

  // ─── Tier 1 · National regulators and bodies ───────────────────────────
  {
    name: "AFM",
    domain: "afm.nl",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["NL"],
    topics: ["audit", "oversight", "enforcement"],
    ingestion_method: "rss",
    feed_url: "https://www.afm.nl/nl-nl/rss/nieuws",
    rationale: "Dutch audit oversight. The home market's supervisor and its enforcement record.",
  },
  {
    name: "NBA",
    domain: "nba.nl",
    source_type: "professional_body",
    authority_tier: 1,
    jurisdictions: ["NL"],
    topics: ["audit", "profession", "standards"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.nba.nl/nieuws/",
    rationale: "Dutch professional body: NV COS changes, practice notes, and the profession's own debate.",
  },
  {
    name: "FRC",
    domain: "frc.org.uk",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["UK"],
    topics: ["audit", "oversight", "reporting"],
    ingestion_method: "rss",
    feed_url: "https://www.frc.org.uk/news-and-events/rss/",
    rationale: "UK audit regulator. Its AI-in-audit guidance is the most developed in Europe.",
  },
  {
    name: "ICAEW",
    domain: "icaew.com",
    source_type: "professional_body",
    authority_tier: 1,
    jurisdictions: ["UK"],
    topics: ["audit", "profession", "technology"],
    ingestion_method: "rss",
    feed_url: "https://www.icaew.com/rss/insights",
    rationale: "Large UK membership body with substantial technology and audit-practice output.",
  },
  {
    name: "APAS",
    // The oversight body publishes under the federal BAFA domain, not under
    // apas.de. The registry keys on the host that actually serves the feed,
    // because that is what a retrieval is checked against.
    domain: "apasbafa.bund.de",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["DE"],
    topics: ["audit", "oversight"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.apasbafa.bund.de/APAS/DE/Home/home_node.html",
    rationale: "German audit oversight — the largest audit market in the EU.",
  },
  {
    name: "H3C / Haute autorité de l'audit",
    domain: "h3c.org",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["FR"],
    topics: ["audit", "oversight"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.h3c.org/actualites",
    rationale: "French audit oversight, including its CSRD assurance positions.",
  },

  // ─── Tier 1 · Vendors, for product fact ────────────────────────────────
  {
    name: "Anthropic — news",
    domain: "anthropic.com",
    source_type: "vendor",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "models"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.anthropic.com/news",
    rationale: "Model and capability announcements, first-party. Tier 1 for what the product does, not for what it means.",
  },
  {
    name: "OpenAI — news",
    domain: "openai.com",
    source_type: "vendor",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "models"],
    ingestion_method: "html_scrape",
    feed_url: "https://openai.com/news/",
    rationale: "Same: first-party product fact.",
  },
  {
    name: "Microsoft — official blog",
    domain: "blogs.microsoft.com",
    source_type: "vendor",
    authority_tier: 1,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "enterprise", "tooling"],
    ingestion_method: "rss",
    feed_url: "https://blogs.microsoft.com/feed/",
    rationale: "Copilot is the AI tool most firms actually deploy; its release notes are audit-relevant fact.",
  },

  // ─── Tier 2 · Trade press and analysis ─────────────────────────────────
  {
    name: "Accountancy Age",
    domain: "accountancyage.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["UK"],
    topics: ["profession", "firms", "audit"],
    ingestion_method: "rss",
    feed_url: "https://www.accountancyage.com/feed/",
    rationale: "UK profession news — firm moves, regulatory reaction, market structure.",
  },
  {
    name: "Accountancy Daily",
    domain: "accountancydaily.co",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["UK"],
    topics: ["profession", "tax", "audit"],
    ingestion_method: "rss",
    feed_url: "https://www.accountancydaily.co/rss.xml",
    rationale: "Fast UK coverage of standards and enforcement.",
  },
  {
    name: "Accountant.nl",
    domain: "accountant.nl",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["NL"],
    topics: ["profession", "audit"],
    ingestion_method: "rss",
    feed_url: "https://www.accountant.nl/rss/",
    license_notes: "Dutch-language source; the desk publishes in English, so this is for discovery and context.",
    rationale: "The Dutch profession's trade publication — how the home market reads a development.",
  },
  {
    name: "FM / Financial Management",
    domain: "fm-magazine.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["finance", "cfo"],
    ingestion_method: "rss",
    feed_url: "https://www.fm-magazine.com/rss/news.xml",
    rationale: "The CFO-function half of the audience.",
  },
  {
    name: "CFO Dive",
    domain: "cfodive.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["finance", "cfo", "technology"],
    ingestion_method: "rss",
    feed_url: "https://www.cfodive.com/feeds/news/",
    rationale: "Finance-function technology adoption, well sourced.",
  },
  {
    name: "Reuters — legal and regulatory",
    domain: "reuters.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["regulation", "markets", "enforcement"],
    ingestion_method: "rss",
    feed_url: "https://www.reuters.com/arc/outboundfeeds/rss/",
    license_notes: "Headlines and short extracts only. Never a paraphrase substituting for the primary text.",
    rationale: "Breaks regulatory stories early. Used to discover, not to cite.",
  },
  {
    name: "Financial Times — regulation",
    domain: "ft.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["regulation", "firms", "markets"],
    ingestion_method: "rss",
    feed_url: "https://www.ft.com/rss/home",
    license_notes: "Paywalled. Headline-level discovery only; do not store body text.",
    rationale: "Best coverage of Big Four market structure and audit reform politics.",
  },
  {
    name: "International Accounting Bulletin",
    domain: "internationalaccountingbulletin.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["firms", "profession"],
    ingestion_method: "rss",
    feed_url: "https://www.internationalaccountingbulletin.com/feed/",
    rationale: "Firm-level news: networks, mergers, private-equity entry into audit.",
  },
  {
    name: "Deloitte — IAS Plus",
    domain: "iasplus.com",
    source_type: "firm",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["accounting", "standards"],
    ingestion_method: "rss",
    feed_url: "https://www.iasplus.com/en/feeds/news.xml",
    rationale: "The best free running commentary on standard-setting. Secondary by construction.",
  },
  {
    name: "PwC — viewpoint and regulatory updates",
    domain: "pwc.com",
    source_type: "firm",
    authority_tier: 2,
    jurisdictions: ["GLOBAL", "EU"],
    topics: ["accounting", "assurance", "regulation"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.pwc.com/gx/en/services/audit-assurance/publications.html",
    rationale: "Firm interpretation of new requirements — useful context, never a primary citation.",
  },
  {
    name: "KPMG — regulatory insights",
    domain: "kpmg.com",
    source_type: "firm",
    authority_tier: 2,
    jurisdictions: ["GLOBAL", "EU"],
    topics: ["regulation", "assurance"],
    ingestion_method: "html_scrape",
    feed_url: "https://kpmg.com/xx/en/home/insights.html",
    rationale:
      "Firm interpretation of new requirements, and often the first published read on how a rule will be applied in practice. Context only — never a primary citation.",
  },
  {
    name: "EY — assurance insights",
    domain: "ey.com",
    source_type: "firm",
    authority_tier: 2,
    jurisdictions: ["GLOBAL", "EU"],
    topics: ["assurance", "reporting"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.ey.com/en_gl/insights/assurance",
    rationale:
      "Assurance and reporting commentary, useful for how a requirement is landing across the market. Context only — never a primary citation.",
  },
  {
    name: "Bird & Bird — AI and tech regulation",
    domain: "twobirds.com",
    source_type: "firm",
    authority_tier: 2,
    jurisdictions: ["EU", "UK"],
    topics: ["regulation", "ai", "legal"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.twobirds.com/en/insights",
    rationale: "Law-firm analysis of the AI Act — the interpretive layer between text and practice.",
  },
  {
    name: "The Register — enterprise software",
    domain: "theregister.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["enterprise", "tooling", "cybersecurity"],
    ingestion_method: "rss",
    feed_url: "https://www.theregister.com/headlines.atom",
    rationale: "Sceptical enterprise-software coverage. Good at finding what a vendor announcement omits.",
  },
  {
    name: "Krebs on Security",
    domain: "krebsonsecurity.com",
    source_type: "news",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["cybersecurity", "data"],
    ingestion_method: "rss",
    feed_url: "https://krebsonsecurity.com/feed/",
    rationale: "Breach reporting that reaches IT-audit scope before the supervisors do.",
  },
  {
    name: "MLOps / Hugging Face blog",
    domain: "huggingface.co",
    source_type: "vendor",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "models", "tooling"],
    ingestion_method: "rss",
    feed_url: "https://huggingface.co/blog/feed.xml",
    rationale: "Capability shifts in open models, which is where firm-internal deployments come from.",
  },

  // ─── Tier 2 · Academic and research ────────────────────────────────────
  {
    name: "SSRN — accounting research",
    domain: "ssrn.com",
    source_type: "research",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["research", "accounting", "audit"],
    ingestion_method: "html_scrape",
    feed_url: "https://www.ssrn.com/index.cfm/en/accounting-research-network/",
    rationale: "Working papers on audit quality and AI in assurance, months before journal publication.",
  },
  {
    name: "arXiv — cs.AI and cs.CL",
    domain: "arxiv.org",
    source_type: "research",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "research"],
    ingestion_method: "json_api",
    feed_url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI",
    rationale: "High volume, low hit rate — but the Research Note format exists for the few that matter.",
  },
  {
    name: "Auditing: A Journal of Practice & Theory",
    domain: "publications.aaahq.org",
    source_type: "research",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["audit", "research"],
    ingestion_method: "html_scrape",
    feed_url: "https://publications.aaahq.org/ajpt/issue",
    rationale: "The main peer-reviewed audit journal. Slow, occasionally decisive.",
  },
  {
    name: "Journal of Accounting Research",
    domain: "onlinelibrary.wiley.com",
    source_type: "research",
    authority_tier: 2,
    jurisdictions: ["GLOBAL"],
    topics: ["accounting", "research"],
    ingestion_method: "rss",
    feed_url: "https://onlinelibrary.wiley.com/feed/1475679x/most-recent",
    rationale: "As above, for financial reporting.",
  },

  // ─── Tier 3 · Discovery only ───────────────────────────────────────────
  // None of these can, on its own, send a story into research (decision D1).
  {
    name: "Hacker News — front page",
    domain: "news.ycombinator.com",
    source_type: "community",
    authority_tier: 3,
    jurisdictions: ["GLOBAL"],
    topics: ["ai", "tooling", "enterprise"],
    // The Firebase API would serve this too, but it is on a different host,
    // and a feed that does not belong to its registered domain is exactly what
    // the registry refuses — a tier means nothing if the row can point
    // anywhere.
    ingestion_method: "rss",
    feed_url: "https://news.ycombinator.com/rss",
    rationale: "Surfaces capability shifts early. Signal only.",
  },
  {
    name: "r/accounting",
    domain: "reddit.com",
    source_type: "community",
    authority_tier: 3,
    jurisdictions: ["GLOBAL"],
    topics: ["profession", "practice"],
    ingestion_method: "json_api",
    feed_url: "https://www.reddit.com/r/accounting/top.json",
    rationale: "What practitioners are actually complaining about. Never a source, sometimes a question worth answering.",
  },
  {
    name: "LinkedIn — audit technology commentary",
    domain: "linkedin.com",
    source_type: "community",
    authority_tier: 3,
    jurisdictions: ["EU", "UK"],
    topics: ["profession", "ai"],
    ingestion_method: "manual",
    feed_url: "",
    license_notes: "No automated retrieval. Manual entry only — LinkedIn's terms forbid scraping.",
    rationale: "Where European audit partners discuss tooling. Manual because the terms say so.",
  },
  {
    name: "AI Act implementation tracker (community)",
    domain: "artificialintelligenceact.eu",
    source_type: "community",
    authority_tier: 3,
    jurisdictions: ["EU"],
    topics: ["ai", "regulation"],
    ingestion_method: "html_scrape",
    feed_url: "https://artificialintelligenceact.eu/developments/",
    rationale: "Useful index of AI Act milestones. Always verify against EUR-Lex before citing.",
  },
];

/**
 * Turn the proposal into registry rows.
 *
 * `fetch_allowed` is false for every row without exception. Retrieval
 * permission is a per-site question about robots.txt and terms, and nobody has
 * answered it yet. A default of true would mean the first crawl happened
 * because a seed file assumed consent.
 */
export function proposedAsSourceCreates(): SourceCreate[] {
  return PROPOSED_SOURCES.map((p) => ({
    name: p.name,
    domain: p.domain,
    source_type: p.source_type,
    authority_tier: p.authority_tier,
    jurisdictions: p.jurisdictions,
    topics: p.topics,
    ingestion_method: p.ingestion_method,
    feed_url: p.feed_url,
    fetch_frequency: DEFAULT_FREQUENCY[p.authority_tier],
    fetch_allowed: false,
    license_notes: p.license_notes ?? "",
    snapshot_retention: DEFAULT_RETENTION[p.authority_tier],
  }));
}

export function proposedCountByTier(): Record<Tier, number> {
  const counts = { 1: 0, 2: 0, 3: 0 } as Record<Tier, number>;
  for (const p of PROPOSED_SOURCES) counts[p.authority_tier]++;
  return counts;
}
