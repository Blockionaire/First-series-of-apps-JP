/* ============================================================================
   data-process.js — the process-level interim audit model.

   Revenue is not one linear process. Machine sales, spare part sales and
   service contracts are materially different flows that share most of their
   steps and converge at revenue posting. The step model is therefore a graph:
   every step declares which variants it belongs to and what follows it.

     variants          the three Revenue process variants
     processSteps      the Process Understanding Map, as a graph
     lineWalkthroughs  one traced transaction per variant, each with its own
                       steps, evidence and verdicts
     controlTest       the control-testing concept, for one control

   Ids reference the same objects as data-model.js (C-*, G-*, R-*), so the map,
   the traces and the matrix are views of one connected model.
   ========================================================================== */

/* --- The seven-step interim workflow -------------------------------------- */

export const journey = [
  { id: "prepare",       n: 1, name: "Prepare",           href: "#/prepare",
    blurb: "What we already know, and who we need" },
  { id: "interview",     n: 2, name: "Process interview", href: "#/interview",
    blurb: "How the process actually works" },
  { id: "understanding", n: 3, name: "Understanding",     href: "#/understanding",
    blurb: "Describe it, and check the description" },
  { id: "controls",      n: 4, name: "Controls & findings", href: "#/controls",
    blurb: "What controls it, and what is wrong" },
  { id: "trace",         n: 5, name: "Line walkthrough",  href: "#/trace",
    blurb: "Do real transactions behave that way?" },
  { id: "testing",       n: 6, name: "Control testing",   href: "#/testing",
    blurb: "Do the controls we rely on operate?" },
  { id: "complete",      n: 7, name: "Complete",          href: "#/complete",
    blurb: "Reviewed, signed and handed forward" },
];

/* --- Firm methodology configuration (mocked) ------------------------------ */

export const methodologyConfig = {
  requiresManagerReview: true,
  requiresPartnerReview: false,
  partnerReviewNote: "Partner review of process-level interim work is required only for PIE and " +
    "listed engagements under the firm's methodology. This engagement is neither.",
};

/* --- Revenue process variants --------------------------------------------- */
/* A process distinction, not a reporting one: machines and spare parts are one
   revenue stream and two materially different processes. */

export const variants = [
  { id: "V1", name: "Machine sales", short: "Machines", value: "EUR 34.3m",
    recognition: "At a point in time, on customer acceptance",
    what: "Engineered conveyor and handling systems, quoted, built, delivered and installed at the customer site.",
    stream: "Machines and spare parts" },
  { id: "V2", name: "Spare part sales", short: "Spare parts", value: "EUR 6.9m",
    recognition: "At a point in time, on despatch",
    what: "Parts ordered by e-mail or through the webshop, picked and despatched without installation.",
    stream: "Machines and spare parts" },
  { id: "V3", name: "Service and maintenance contracts", short: "Service", value: "EUR 7.4m",
    recognition: "Over time, straight-line across the contract term",
    what: "Maintenance contracts held in ServiceTrack, billed quarterly in advance and released from deferral monthly.",
    stream: "Service contracts" },
];

/* --- The Process Understanding Map, as a graph -----------------------------
   `variants` says which flows a step belongs to; `next` says what follows it,
   which is where the branching and the convergence live.
   -------------------------------------------------------------------------- */

export const processSteps = [
  { id: "P1", name: "Quotation", actor: "Sales engineer", system: "Business Central",
    variants: ["V1"], next: ["P2"],
    what: "A quotation is configured and priced, approved above EUR 100,000, and signed by the customer.",
    sub: "R2", controls: ["C-14"], refs: ["T:seg-03", "Q:2"] },

  { id: "P2", name: "Sales order", actor: "Sales administration", system: "Business Central",
    variants: ["V1", "V2"], next: ["P3"], shared: true,
    what: "A signed quotation becomes a sales order. Spare-part orders arrive by e-mail or webshop and are keyed directly, with no reconciliation to the mailbox.",
    sub: "R2", controls: ["C-11", "C-01"], refs: ["T:seg-03", "T:seg-04", "T:seg-09"] },

  { id: "P3", name: "Credit check", actor: "Credit control", system: "Business Central",
    variants: ["V1", "V2"], next: ["P4"], shared: true, contested: true,
    what: "The order is blocked automatically where exposure would exceed the customer's credit limit, and released by credit control.",
    sub: "R3", controls: ["C-02"], refs: ["T:seg-18", "D:note-1"] },

  { id: "P4", name: "Despatch", actor: "Van Dijk Logistics", system: "Van Dijk WMS → Business Central",
    variants: ["V1", "V2"], next: ["P5", "P6"], shared: true,
    what: "Goods are picked and despatched by the logistics provider, which transmits a daily confirmation file that posts the shipment.",
    sub: "R4", controls: [], refs: ["T:seg-19", "T:seg-21", "D:doc-so-11"] },

  { id: "P5", name: "Installation & acceptance", actor: "Service engineers", system: "ServiceTrack",
    variants: ["V1"], next: ["P6"], optional: true,
    skipNote: "Spare part sales have no installation step — revenue is recognised on despatch.",
    what: "Machines are installed at the customer site and the customer signs an acceptance protocol. Machine revenue is recognised on acceptance.",
    sub: "R6", controls: [], refs: ["T:seg-25"] },

  { id: "P6", name: "Invoicing", actor: "Business Central", system: "Business Central (automated)",
    variants: ["V1", "V2"], next: ["P7"], shared: true,
    what: "An overnight batch raises an invoice from each posted shipment, taking quantity from the shipment and price from the order.",
    sub: "R5", controls: ["C-03", "C-04"], refs: ["T:seg-13", "D:doc-py-3"] },

  { id: "S1", name: "Service contract", actor: "Commercial director", system: "ServiceTrack",
    variants: ["V3"], next: ["S2"],
    what: "A maintenance contract is agreed with a term, a scope and a periodic fee, and recorded in ServiceTrack.",
    sub: "R1", controls: ["C-14"], refs: ["T:seg-23"] },

  { id: "S2", name: "Contract billing", actor: "Financial controller", system: "ServiceTrack",
    variants: ["V3"], next: ["S3"],
    what: "Service contracts are billed quarterly in advance from ServiceTrack.",
    sub: "R5", controls: [], refs: ["T:seg-23"] },

  { id: "S3", name: "Deferral & release", actor: "ServiceTrack", system: "ServiceTrack → Business Central",
    variants: ["V3"], next: ["P7"],
    what: "ServiceTrack holds the deferral schedule and posts the monthly release of deferred revenue into Business Central.",
    sub: "R6", controls: ["C-12", "C-06"], refs: ["T:seg-23", "T:seg-24"] },

  { id: "P7", name: "Revenue posting", actor: "Financial controller", system: "Business Central GL",
    variants: ["V1", "V2", "V3"], next: ["P8"], shared: true, merge: true,
    what: "Revenue posts to the general ledger. All three variants converge here, and the account is reconciled monthly.",
    sub: "R6", controls: ["C-06", "C-13"], refs: ["T:seg-24", "T:seg-35"] },

  { id: "P8", name: "Cash receipt", actor: "Credit control", system: "Business Central",
    variants: ["V1", "V2", "V3"], next: [], shared: true,
    what: "Bank statements load daily and match automatically on the payment reference. Unmatched receipts go to a suspense list.",
    sub: "R8", controls: ["C-08", "C-07"], refs: ["T:seg-30"] },
];

/** The steps of one variant, in path order. */
export const stepsForVariant = (vid) => processSteps.filter((p) => p.variants.includes(vid));

/* --- Findings that are not control gaps ------------------------------------ */

export const processFindings = [
  { id: "F-01", step: "P5", variant: "V1", kind: "observation", severity: "observation",
    title: "Where signed acceptance protocols are retained was not established",
    detail: "Machine revenue is recognised on customer acceptance, so the acceptance protocol is the document that fixes the recognition date. We did not establish where the signed protocols are held, who holds them, or how the acceptance date reaches the accounting records.",
    impact: "Without a retained, dated protocol the recognition date cannot be corroborated for any machine sale.",
    refs: ["T:seg-25"], fromTrace: false },
];

/** Raised when the auditor concludes an exception on the machine-sales trace. */
export const traceFindings = {
  "SO-24188": {
    id: "F-02", step: "P6", variant: "V1", kind: "exception", severity: "deficiency",
    title: "Revenue invoiced and posted before the customer accepted the installation",
    detail: "On order SO-24188 the invoice was raised on 15 September 2026 and posted to revenue the same day. The customer signed the acceptance protocol on 22 September 2026. Under the entity's stated policy, machine revenue is recognised on acceptance, so revenue was recognised seven days before the performance obligation was satisfied.",
    impact: "The automated invoicing batch triggers on despatch, not on acceptance, so this affects every machine sale where installation lags delivery rather than being isolated. It bears directly on cut-off and on the occurrence assertion.",
    remediation: "Suppress the automated invoice for machine sales until the acceptance protocol is recorded, or defer revenue on invoices raised before acceptance and clear the deferral on acceptance.",
    refs: ["T:seg-25", "T:seg-13"], fromTrace: true, fromTransaction: "SO-24188",
  },
};

/* --- Line walkthrough requirements, per variant ----------------------------
   Nothing is hard-coded as always required: firm methodology decides which
   transaction classes need a separate walkthrough, so this is data.
   -------------------------------------------------------------------------- */

export const lineWalkRequirements = {
  V1: { state: "required", reason: null },
  V2: { state: "required", reason: null },
  V3: { state: "not_required",
        reason: "Service revenue is recognised on a time basis from contract data rather than from a transaction flow. The deferral schedule is tested substantively against the contract terms, so a transaction-level walkthrough would not add evidence." },
};

/* --- The traced transactions ----------------------------------------------
   Two, both fully working. Each carries its own variant, steps, evidence and
   verdicts; selecting one loads that one.
   -------------------------------------------------------------------------- */

export const transactions = [
  {
    id: "SO-24188", variant: "V1", customer: "Bakkerij Groep Nederland B.V.", value: "EUR 284,500",
    what: "PL-400 conveyor line, delivered and installed in September",
    why: "The largest machine sale in the interim period, and the only one where installation spans the reporting date — the case most likely to test the recognition policy.",
    recommended: true,
    steps: [
      { id: "t1", step: "P1",
        expectedStep: "A quotation is configured, approved above EUR 100,000 by the Commercial Director, and signed by the customer.",
        expectedControl: "C-14 — quotations above EUR 100,000 are approved before issue",
        expectedEvidence: "Signed quotation carrying the approval record",
        actualEvidence: "QUO-2026-0412, EUR 284,500, approved by B. Kuipers on 12 August 2026 and signed by the customer on 14 August 2026.",
        observation: "The quotation exceeds the threshold and carries the Commercial Director's approval before issue.",
        suggested: "corroborated" },
      { id: "t2", step: "P2",
        expectedStep: "Sales administration converts the signed quotation into a sales order carrying the quotation reference and price.",
        expectedControl: "C-11 — machine orders are created only from a customer-signed quotation",
        expectedEvidence: "Sales order referencing the quotation, at the quoted price",
        actualEvidence: "SO-24188 created 15 August 2026, references QUO-2026-0412, value EUR 284,500. No price override recorded on any line.",
        observation: "The order price agrees to the signed quotation and no override was applied.",
        suggested: "corroborated" },
      { id: "t3", step: "P3",
        expectedStep: "The order is checked against the customer's credit limit and blocked if exposure would exceed it.",
        expectedControl: "C-02 — orders exceeding the credit limit are blocked and released only by credit control",
        expectedEvidence: "Credit check record; a release log entry if the order was blocked",
        actualEvidence: "Customer limit EUR 400,000, exposure at order date EUR 311,700. No block was triggered and no release was required.",
        observation: "The control did not need to operate on this transaction. Its design was evaluated separately; this trace provides no evidence about whether it operates.",
        suggested: "corroborated", note: "not_triggered" },
      { id: "t4", step: "P4",
        expectedStep: "Van Dijk Logistics picks and despatches the goods and transmits a daily confirmation file that posts the shipment.",
        expectedControl: "None identified — the despatch file is not reconciled to internal records (G-02)",
        expectedEvidence: "Despatch note and the confirmation file entry posting the shipment",
        actualEvidence: "DN-88214 despatched 2 September 2026; shipment posted in Business Central from the Van Dijk file of the same evening. Quantities agree to the order.",
        observation: "The despatch posted correctly on this transaction. Because no reconciliation is performed, this trace does not evidence that the file is complete generally.",
        suggested: "corroborated" },
      { id: "t5", step: "P5",
        expectedStep: "The machine is installed and the customer signs an acceptance protocol. Revenue is recognised on acceptance.",
        expectedControl: "None identified — retention of the acceptance protocol was not established (F-01)",
        expectedEvidence: "Acceptance protocol, signed and dated by the customer",
        actualEvidence: "Acceptance protocol ACC-24188, signed by the customer's plant manager on 22 September 2026. Obtained from the project file on request; it is not held in ServiceTrack or Business Central.",
        observation: "The customer accepted the installation on 22 September. The invoice for this order is dated 15 September — seven days earlier.",
        suggested: "exception",
        exception: "Revenue was recognised before the performance obligation was satisfied. Under the entity's stated policy machine revenue is recognised on acceptance, and the acceptance protocol post-dates the invoice and the revenue posting by seven days.",
        why: "comparing the acceptance date on the protocol with the invoice date captured at the invoicing step of this trace." },
      { id: "t6", step: "P6",
        expectedStep: "The overnight batch raises an invoice from the posted shipment, taking quantity from the shipment and price from the order.",
        expectedControl: "C-03 — invoices are generated automatically from the posted shipment without re-keying",
        expectedEvidence: "Invoice linked to the shipment, priced from the order",
        actualEvidence: "INV-2026-11902 dated 15 September 2026, EUR 284,500, generated automatically from shipment DN-88214. Price and quantity agree to the order and the despatch.",
        observation: "The invoice was generated as described and agrees to the order and despatch. The control operated. The batch triggers on despatch, not on acceptance, which is what produced the exception at installation.",
        suggested: "corroborated" },
      { id: "t7", step: "P7",
        expectedStep: "The invoice posts to the revenue account in the general ledger.",
        expectedControl: "C-06 — the revenue account is reconciled to the billing sub-ledger monthly",
        expectedEvidence: "General ledger entry agreeing to the invoice",
        actualEvidence: "Posted to account 8000 (Revenue — machines) on 15 September 2026, EUR 284,500, journal reference SL-09-11902.",
        observation: "The ledger entry agrees to the invoice in amount and date.",
        suggested: "corroborated" },
    ],
    untraced: [
      { step: "P8", kind: "not_yet",
        why: "The invoice falls due on 15 October 2026 and was unpaid at the date of this walkthrough. Cash receipt has not occurred yet and cannot be traced on this transaction." },
    ],
  },

  {
    id: "SO-24310", variant: "V2", customer: "Nordvest Seafood AS", value: "EUR 31,800",
    what: "Replacement belts and drive units, ordered by e-mail in August",
    why: "A spare-part order, which enters through the sales mailbox rather than a quotation and has no installation step — a materially different path through the same process.",
    recommended: false,
    steps: [
      { id: "u1", step: "P2",
        expectedStep: "An order arriving by e-mail is keyed into Business Central by sales administration.",
        expectedControl: "None identified — there is no reconciliation between the sales mailbox and recorded orders",
        expectedEvidence: "Customer e-mail and the sales order keyed from it",
        actualEvidence: "Customer e-mail of 18 August 2026; SO-24310 keyed 19 August 2026 for the same part numbers and quantities. Prices taken from the customer price list.",
        observation: "The order agrees to the customer's e-mail. Because no reconciliation exists, this trace gives no evidence that other e-mailed orders were captured.",
        suggested: "corroborated" },
      { id: "u2", step: "P3",
        expectedStep: "The order is checked against the customer's credit limit.",
        expectedControl: "C-02 — orders exceeding the credit limit are blocked and released only by credit control",
        expectedEvidence: "Credit check record; a release log entry if blocked",
        actualEvidence: "Customer limit EUR 75,000, exposure at order date EUR 41,200. No block was triggered.",
        observation: "The control did not need to operate on this transaction, so this trace provides no evidence about whether it operates.",
        suggested: "corroborated", note: "not_triggered" },
      { id: "u3", step: "P4",
        expectedStep: "Van Dijk Logistics picks and despatches the goods and the confirmation file posts the shipment.",
        expectedControl: "None identified — the despatch file is not reconciled to internal records (G-02)",
        expectedEvidence: "Despatch note and the posted shipment",
        actualEvidence: "DN-87901 despatched 21 August 2026; shipment posted the same evening from the Van Dijk file. Quantities agree to the order.",
        observation: "The despatch posted correctly and agrees to the order.",
        suggested: "corroborated" },
      { id: "u4", step: "P6",
        expectedStep: "The overnight batch raises an invoice from the posted shipment.",
        expectedControl: "C-03 — invoices are generated automatically from the posted shipment without re-keying",
        expectedEvidence: "Invoice linked to the shipment, priced from the order",
        actualEvidence: "INV-2026-11588 dated 22 August 2026, EUR 31,800, generated automatically from shipment DN-87901.",
        observation: "The invoice was raised the day after despatch and agrees to the order in price and quantity. There is no installation step in this variant, so despatch is the point at which the performance obligation is satisfied and the invoice date is the correct recognition date.",
        suggested: "corroborated" },
      { id: "u5", step: "P7",
        expectedStep: "The invoice posts to the revenue account in the general ledger.",
        expectedControl: "C-06 — the revenue account is reconciled to the billing sub-ledger monthly",
        expectedEvidence: "General ledger entry agreeing to the invoice",
        actualEvidence: "Posted to account 8010 (Revenue — spare parts) on 22 August 2026, EUR 31,800, journal reference SL-08-11588.",
        observation: "The ledger entry agrees to the invoice in amount and date, and posts to the spare-parts revenue account.",
        suggested: "corroborated" },
      { id: "u6", step: "P8",
        expectedStep: "The customer's payment is received and matched automatically against the invoice.",
        expectedControl: "C-08 — bank receipts are matched daily and unapplied cash is cleared by credit control",
        expectedEvidence: "Bank statement line matched to the invoice",
        actualEvidence: "Payment of EUR 31,800 received 12 September 2026 and matched automatically on the payment reference. No suspense entry arose.",
        observation: "The transaction completes through to cash. The automated matching operated on this item.",
        suggested: "corroborated" },
    ],
    untraced: [
      { step: "P1", kind: "not_applicable",
        why: "Spare part orders do not begin with a quotation — they arrive directly by e-mail or through the webshop." },
      { step: "P5", kind: "not_applicable",
        why: "Spare parts are not installed. Revenue is recognised on despatch, so there is no acceptance step in this variant." },
    ],
  },
];

export const txnById = (id) => transactions.find((t) => t.id === id) || null;

/* --- Control testing — future-state concept, one control ------------------ */

export const controlTest = {
  controlId: "C-04",
  objective: "Determine whether manual invoices raised outside the automated flow were approved by the financial controller before issue.",
  nature: ["inspection", "inquiry"],
  population: "Manual invoices posted to revenue accounts between 1 January and 30 September 2026",
  populationSource: "Business Central invoice register, filtered to invoices with no linked shipment",
  completeness: "Agree the register total to the revenue sub-ledger and confirm the filter captures every invoice without a shipment link",
  populationSize: 34,
  timing: "Interim, with a roll-forward to the year end",
  sampleSize: 5,
  sampleBasis: "Firm parameter table: event-driven control, higher risk — 5 items",
  extendedSampleSize: 10,
  extendedBasis: "Firm parameter table: one exception in an initial sample of 5 — extend to 10 before concluding",
  attributes: [
    "The invoice carries an approval record naming the financial controller",
    "The approval pre-dates the invoice issue date",
    "The invoice amount and customer agree to the supporting settlement or milestone documentation",
  ],
  evidenceToRequest: ["Approval record for each selected invoice", "Supporting settlement or milestone agreement"],
  results: [
    { id: "INV-2026-10331", ok: true, note: "Approval recorded by R. Timmermans on 14 March, one day before issue." },
    { id: "INV-2026-10744", ok: true, note: "Approval recorded 2 May, same day as issue." },
    { id: "INV-2026-11085", ok: true, note: "Approval recorded 19 June, two days before issue." },
    { id: "INV-2026-11460", ok: false, note: "No approval record located. The controller recalls approving it by e-mail; the e-mail could not be produced." },
    { id: "INV-2026-11871", ok: true, note: "Approval recorded 9 September, same day as issue." },
  ],
  extendedResults: [
    { id: "INV-2026-10192", ok: true, note: "Approval recorded 21 February, same day as issue." },
    { id: "INV-2026-10908", ok: true, note: "Approval recorded 3 June, one day before issue." },
    { id: "INV-2026-11203", ok: false, note: "No approval record located. Raised as a settlement credit by finance; the controller was on leave that week." },
    { id: "INV-2026-11655", ok: true, note: "Approval recorded 28 August, same day as issue." },
    { id: "INV-2026-11940", ok: true, note: "Approval recorded 24 September, two days before issue." },
  ],
  priorYearNote: "The control was tested in the FY2025 audit and found effective. ISA 330 permits using evidence from a previous audit for an unchanged control, provided it is tested at least once in every third audit — a decision for the auditor, not applied automatically.",
};

/* --- Context carried into interim from earlier engagement work ------------ */

export const carriedContext = [
  { kind: "Inherent risk factor", t: "Change — warehousing outsourced to Van Dijk Logistics in March 2026",
    d: "Identified during planning. A new service organisation sits in the middle of the revenue process for the first time." },
  { kind: "Inherent risk factor", t: "Susceptibility to bias — incentives tied to reported revenue",
    d: "Sales commission on invoiced revenue, a turnover component in the Commercial Director's bonus, and an EBITDA covenant tested half-yearly." },
  { kind: "Entity-level", t: "Two revenue recognition bases in one process",
    d: "Point-in-time for machines and spare parts, over time for service contracts, since the 2024 maintenance acquisition." },
  { kind: "Systems in scope", t: "Business Central, ServiceTrack, Van Dijk WMS",
    d: "Confirmed during entity and IT understanding. ITGC work over Business Central is a separate process." },
  { kind: "Prior year", t: "FY2025 revenue process narrative approved 12 February 2026",
    d: "Warehouse operations were in-house. Prior-year controls over despatch no longer describe the process." },
  { kind: "Prior year", t: "No control deficiencies reported to management on Revenue in FY2025",
    d: "Prior-year management letter carried no revenue points." },
];
