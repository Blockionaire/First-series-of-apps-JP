/**
 * Labelled clustering cases: which items are the same development.
 *
 * Written in the house style of the publishers they imitate, because the
 * failure being guarded against is house style — every EBA item opens "The
 * European Banking Authority (EBA) today published…", every ESMA item "ESMA,
 * the EU's financial markets regulator and supervisor, today…". A clusterer
 * that reads that as subject matter merges a stress test with a crypto
 * consultation (CODE_AUDIT.md H3, reproduced in production data).
 *
 * `story` is the gold label. Items sharing a label must end up together
 * (otherwise: a missed merge); items with different labels must not
 * (otherwise: a false merge). Items arrive in the listed order, one source's
 * feed at a time, as a discovery run delivers them.
 *
 * Hard negatives are deliberate: same publisher, same week, overlapping
 * vocabulary ("guidelines", "consultation", "standards"), different
 * development.
 */

const D = (day, hour = 9) => `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

const EBA_LEAD = (what) =>
  `The European Banking Authority (EBA) today published ${what}. As part of its mandate to contribute to a single rulebook in banking, the EBA publishes guidelines, standards and reports to promote convergence of supervisory practices across the European Union.`;

const ESMA_LEAD = (what) =>
  `ESMA, the EU's financial markets regulator and supervisor, today ${what}. ESMA's mission is to enhance investor protection and promote stable and orderly financial markets in the European Union.`;

/** `issuer`: a Tier-1 regulator or standard setter announcing its own act. */
export const SOURCES = {
  eba: { id: 1, tier: 1, issuer: true },
  esma: { id: 2, tier: 1, issuer: true },
  iaasb: { id: 3, tier: 1, issuer: true },
  frc: { id: 4, tier: 1, issuer: true },
  ec: { id: 5, tier: 1, issuer: true },
  iasb: { id: 6, tier: 1, issuer: true },
  ae: { id: 7, tier: 2, issuer: false }, // Accountancy Europe
  icaew: { id: 8, tier: 2, issuer: false },
  law: { id: 9, tier: 3, issuer: false }, // a law-firm briefing blog
  pcaob: { id: 10, tier: 1, issuer: true },
};

/** Items in feed order. `source` keys SOURCES; `story` is the gold label. */
export const ITEMS = [
  // ── EBA feed: eight publications, one of them covered elsewhere ─────────
  { source: "eba", story: "eba-ml", url: "https://www.eba.europa.eu/publications/ml-irb-guidelines",
    title: "EBA publishes final guidelines on the use of machine learning in internal ratings-based models",
    lead: EBA_LEAD("its final Guidelines on the use of machine learning for internal ratings-based (IRB) credit risk models, setting expectations for explainability, data quality and validation"),
    publishedAt: D(15) },
  { source: "eba", story: "eba-stress", url: "https://www.eba.europa.eu/publications/stress-test-2027",
    title: "EBA launches the 2027 EU-wide stress test",
    lead: EBA_LEAD("the methodology, templates and macroeconomic scenarios for the 2027 EU-wide stress test, which covers 64 banks"),
    publishedAt: D(15, 11) },
  { source: "eba", story: "eba-crypto", url: "https://www.eba.europa.eu/publications/mica-reporting-rts",
    title: "EBA consults on regulatory technical standards for crypto-asset reporting under MiCA",
    lead: EBA_LEAD("a consultation paper on draft regulatory technical standards specifying reporting by issuers of asset-referenced tokens under MiCA"),
    publishedAt: D(16) },
  { source: "eba", story: "eba-aml", url: "https://www.eba.europa.eu/publications/aml-peer-review",
    title: "EBA peer review finds shortcomings in anti-money laundering supervision of payment institutions",
    lead: EBA_LEAD("the results of its peer review of how national authorities supervise anti-money laundering risks in payment institutions"),
    publishedAt: D(16, 12) },
  { source: "eba", story: "eba-mrel", url: "https://www.eba.europa.eu/publications/mrel-dashboard-q2",
    title: "MREL dashboard shows banks close to meeting final targets",
    lead: EBA_LEAD("its quarterly MREL dashboard, monitoring banks' progress towards minimum requirements for own funds and eligible liabilities"),
    publishedAt: D(17) },
  { source: "eba", story: "eba-remuneration", url: "https://www.eba.europa.eu/publications/high-earners-2025",
    title: "Number of high earners in EU banks rises by eight per cent",
    lead: EBA_LEAD("its annual report on high earners, showing the number of individuals receiving more than one million euro in remuneration"),
    publishedAt: D(17, 13) },
  { source: "eba", story: "eba-esg", url: "https://www.eba.europa.eu/publications/esg-risk-guidelines",
    title: "EBA issues guidelines on the management of ESG risks",
    lead: EBA_LEAD("its final Guidelines on the management of environmental, social and governance (ESG) risks, including transition plans required under CRD"),
    publishedAt: D(18) },
  // A JOINT publication of the three ESAs, posted by the EBA and by ESMA:
  // two issuers, one development.
  { source: "eba", story: "esas-joint", url: "https://www.eba.europa.eu/publications/esas-dora-register-guidelines",
    title: "ESAs publish joint guidelines on the DORA register of information templates",
    lead: EBA_LEAD("together with EIOPA and ESMA, joint guidelines on the templates for the register of information on ICT third-party arrangements under DORA"),
    publishedAt: D(17, 8) },
  { source: "eba", story: "eba-irrbb", url: "https://www.eba.europa.eu/publications/irrbb-qa",
    title: "Interest rate risk in the banking book: EBA updates supervisory outlier test Q&A",
    lead: EBA_LEAD("updated questions and answers on the supervisory outlier test for interest rate risk in the banking book (IRRBB)"),
    publishedAt: D(18, 14) },

  // ── ESMA feed: one statement covered elsewhere, three that are not ──────
  { source: "esma", story: "esma-ai", url: "https://www.esma.europa.eu/press-news/ai-investment-services",
    title: "ESMA issues statement on the use of artificial intelligence in investment services",
    lead: ESMA_LEAD("issued a public statement giving initial guidance to firms using artificial intelligence when providing investment services to retail clients"),
    publishedAt: D(15, 10) },
  { source: "esma", story: "esma-mica", url: "https://www.esma.europa.eu/press-news/mica-white-paper-standards",
    title: "ESMA publishes final report on technical standards for crypto-asset white papers",
    lead: ESMA_LEAD("published its final report on technical standards for the form and content of crypto-asset white papers under MiCA"),
    publishedAt: D(16, 10) },
  { source: "esma", story: "esma-names", url: "https://www.esma.europa.eu/press-news/fund-names-guidelines",
    title: "ESMA consults on applying the fund names guidelines to closed-ended funds",
    lead: ESMA_LEAD("launched a consultation on how its guidelines on funds' names using ESG or sustainability-related terms apply to closed-ended funds"),
    publishedAt: D(17, 10) },
  { source: "esma", story: "esas-joint", url: "https://www.esma.europa.eu/press-news/esas-dora-register-guidelines",
    title: "ESAs publish joint guidelines on DORA register of information templates",
    lead: ESMA_LEAD("together with the EBA and EIOPA, published joint guidelines on the register of information on ICT third-party service providers under DORA"),
    publishedAt: D(17, 9) },
  { source: "esma", story: "esma-cra-fine", url: "https://www.esma.europa.eu/press-news/cra-fine",
    title: "ESMA fines a credit rating agency for conflicts of interest breaches",
    lead: ESMA_LEAD("fined a credit rating agency for breaches of the conflicts of interest requirements of the CRA Regulation"),
    publishedAt: D(18, 10) },

  // ── IAASB: two standards, same week, same verbs ─────────────────────────
  { source: "iaasb", story: "isa-240", url: "https://www.iaasb.org/news/isa-240-approved",
    title: "IAASB approves revised ISA 240 on the auditor's responsibilities relating to fraud",
    lead: "The International Auditing and Assurance Standards Board approved the revised standard at its September meeting. The revisions strengthen professional skepticism and communication about fraud.",
    publishedAt: D(16, 15) },
  { source: "iaasb", story: "isa-500", url: "https://www.iaasb.org/news/isa-500-technology",
    title: "IAASB approves targeted revisions to ISA 500 on audit evidence and technology",
    lead: "The International Auditing and Assurance Standards Board approved the revisions at its September meeting. The changes address the use of automated tools and techniques when obtaining audit evidence.",
    publishedAt: D(16, 16) },

  // ── FRC ─────────────────────────────────────────────────────────────────
  { source: "frc", story: "frc-ai", url: "https://www.frc.org.uk/news/ai-in-audit-guidance",
    title: "FRC publishes guidance on the use of artificial intelligence in audit",
    lead: "The Financial Reporting Council has published guidance setting out its expectations for audit firms deploying AI tools, including documentation and oversight of automated techniques.",
    publishedAt: D(17, 9) },
  { source: "frc", story: "frc-isqm", url: "https://www.frc.org.uk/news/isqm-uk-1-consultation",
    title: "FRC consults on revisions to ISQM (UK) 1 quality management",
    lead: "The Financial Reporting Council is consulting on targeted revisions to its quality management standard for audit firms.",
    publishedAt: D(17, 12) },

  // ── European Commission ─────────────────────────────────────────────────
  { source: "ec", story: "omnibus", url: "https://ec.europa.eu/commission/presscorner/omnibus-sustainability",
    title: "Commission adopts Omnibus simplification package on sustainability reporting and due diligence",
    lead: "The European Commission adopted an Omnibus package amending the Corporate Sustainability Reporting Directive (CSRD) and the Corporate Sustainability Due Diligence Directive (CSDDD), reducing the number of companies in scope.",
    publishedAt: D(15, 8) },

  // ── IASB ────────────────────────────────────────────────────────────────
  { source: "iasb", story: "ifrs-18", url: "https://www.ifrs.org/news/ifrs-18-issued",
    title: "IASB issues IFRS 18 Presentation and Disclosure in Financial Statements",
    lead: "IFRS 18 replaces IAS 1 and introduces new required subtotals in the statement of profit or loss, effective for annual periods beginning on or after 1 January 2027.",
    publishedAt: D(16, 8) },

  // ── PCAOB: a hard negative for the FRC's quality management item ────────
  { source: "pcaob", story: "pcaob-qc", url: "https://pcaobus.org/news/qc-1000-effective-date",
    title: "PCAOB postpones effective date of QC 1000 quality control standard",
    lead: "The Public Company Accounting Oversight Board voted to postpone by one year the effective date of its new quality control standard for registered firms.",
    publishedAt: D(17, 18) },

  // ── Accountancy Europe: coverage, mostly ────────────────────────────────
  { source: "ae", story: "eba-ml", url: "https://www.accountancyeurope.eu/news/eba-ml-irb",
    title: "Machine learning in IRB models: what the EBA's final guidelines mean for bank auditors",
    lead: "The EBA's final guidelines on machine learning in internal ratings-based credit risk models raise new questions for auditors assessing banks' model validation.",
    publishedAt: D(16, 9) },
  { source: "ae", story: "omnibus", url: "https://www.accountancyeurope.eu/news/omnibus-csrd",
    title: "Omnibus proposal: Commission narrows CSRD scope and delays reporting waves",
    lead: "Accountancy Europe welcomes the Commission's Omnibus proposal on sustainability reporting but warns that the reduced CSRD scope must not weaken limited assurance.",
    publishedAt: D(15, 17) },
  { source: "ae", story: "eba-stress", url: "https://www.accountancyeurope.eu/news/eba-stress-test-2027",
    title: "EU-wide stress test 2027: EBA releases methodology and scenarios",
    lead: "The EBA's methodology for the 2027 EU-wide stress test will affect audit work on banks' capital planning and forward-looking information.",
    publishedAt: D(16, 14) },
  { source: "ae", story: "ae-ethics", url: "https://www.accountancyeurope.eu/news/ethics-survey",
    title: "Accountancy Europe survey on ethics and independence rules for sustainability assurance",
    lead: "Accountancy Europe launched a survey asking practitioners how ethics and independence requirements apply to sustainability assurance engagements.",
    publishedAt: D(17, 15) },

  // ── ICAEW: coverage ─────────────────────────────────────────────────────
  { source: "icaew", story: "frc-ai", url: "https://www.icaew.com/insights/frc-ai-audit-guidance",
    title: "FRC guidance on AI tools in audits: what firms need to know",
    lead: "The FRC's new guidance on using artificial intelligence in audit sets out expectations on documentation and oversight that firms should review now.",
    publishedAt: D(17, 16) },
  { source: "icaew", story: "isa-240", url: "https://www.icaew.com/insights/revised-isa-240",
    title: "Revised ISA 240: IAASB strengthens auditor fraud responsibilities",
    lead: "The IAASB's approval of the revised fraud standard ISA 240 brings changes to how auditors respond to fraud risk and communicate with those charged with governance.",
    publishedAt: D(17, 10) },
  { source: "icaew", story: "ifrs-18", url: "https://www.icaew.com/insights/ifrs-18-published",
    title: "IFRS 18 published: new presentation requirements replace IAS 1",
    lead: "The IASB has published IFRS 18, bringing new subtotals and management-defined performance measures into the income statement from 2027.",
    publishedAt: D(16, 19) },

  // ── Law-firm blog: tier 3 coverage ──────────────────────────────────────
  { source: "law", story: "esma-ai", url: "https://lawfirm.example/blog/esma-ai-statement",
    title: "ESMA statement on AI in investment services: key takeaways for firms",
    lead: "ESMA's statement on artificial intelligence reminds investment firms that MiFID II organisational and conduct requirements apply when AI tools are used with retail clients.",
    publishedAt: D(16, 11) },
  { source: "law", story: "omnibus", url: "https://lawfirm.example/blog/omnibus-csrd-csddd",
    title: "EU Omnibus: what the CSRD and CSDDD changes mean for companies",
    lead: "The Commission's Omnibus simplification package cuts the number of companies subject to the CSRD and postpones parts of the CSDDD.",
    publishedAt: D(16, 18) },
  { source: "law", story: "law-dora", url: "https://lawfirm.example/blog/dora-register",
    title: "DORA register of information: supervisors start first data collection",
    lead: "Financial entities must submit their register of information on ICT third-party arrangements to national supervisors under DORA.",
    publishedAt: D(17, 11) },
];

/**
 * The EBA case exactly as the audit reproduced it: ten unrelated EBA
 * publications, one feed, the standard EBA lead. Every one is its own story.
 */
export const EBA_TEN = [
  "results of its 2026 EU-wide transparency exercise",
  "final draft regulatory technical standards on crypto-asset reporting",
  "a peer review of anti-money laundering supervision",
  "its report on machine learning in credit risk models",
  "its annual MREL quantitative report",
  "its benchmarking of remuneration practices",
  "guidelines on the management of ESG risks",
  "an opinion on the treatment of legacy instruments",
  "its risk assessment questionnaire for the autumn",
  "an updated list of other systemically important institutions",
].map((what, i) => ({
  source: "eba",
  story: `eba-${i}`,
  url: `https://www.eba.europa.eu/publications/item-${i}`,
  title: `EBA publishes ${what}`,
  lead: EBA_LEAD(what),
  publishedAt: D(15 + (i % 3), 9 + i),
}));
