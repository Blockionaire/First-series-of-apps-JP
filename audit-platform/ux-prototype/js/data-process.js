/* ============================================================================
   data-process.js — the process-level interim audit model (V3).

   Three things the earlier prototype had no representation for:

     processSteps  the Process Understanding Map — the process as understood,
                   built in step 3, annotated with controls and findings in
                   step 4, and traced against a real transaction in step 5
     lineWalk      one real transaction, traced end to end through that map
     controlTest   the control-testing concept, for one control, future state

   Ids reference the same objects as data-model.js (C-*, G-*, R-*), so the map,
   the trace and the matrix are views of one connected model rather than three
   parallel data sets.
   ========================================================================== */

/* --- The seven-step interim workflow -------------------------------------- */

export const journey = [
  { id: "prepare",       n: 1, name: "Prepare",          href: "#/prepare",
    blurb: "What we already know, and who we need" },
  { id: "walkthrough",   n: 2, name: "Walkthrough",      href: "#/walkthrough",
    blurb: "How the process actually works" },
  { id: "understanding", n: 3, name: "Understanding",    href: "#/understanding",
    blurb: "Describe it, and check the description" },
  { id: "controls",      n: 4, name: "Controls & findings", href: "#/controls",
    blurb: "What controls it, and what is wrong" },
  { id: "trace",         n: 5, name: "Line walkthrough", href: "#/trace",
    blurb: "Does a real transaction behave that way?" },
  { id: "testing",       n: 6, name: "Control testing",  href: "#/testing",
    blurb: "Do the controls we rely on operate?", future: true },
  { id: "complete",      n: 7, name: "Complete",         href: "#/complete",
    blurb: "Finished and defensible" },
];

/* --- The Process Understanding Map ----------------------------------------
   Eight steps, quotation to cash. `controls` and `findings` are ids from
   data-model.js; the map does not duplicate their content.
   -------------------------------------------------------------------------- */

export const processSteps = [
  { id: "P1", name: "Quotation", actor: "Sales engineer", system: "Business Central",
    what: "A quotation is configured and priced, approved above EUR 100,000, and signed by the customer.",
    sub: "R2", controls: ["C-14"], findings: [], refs: ["T:seg-03", "Q:2"] },

  { id: "P2", name: "Sales order", actor: "Sales administration", system: "Business Central",
    what: "The signed quotation is converted into a sales order. Spare-part orders arrive by e-mail or webshop and are keyed directly.",
    sub: "R2", controls: ["C-11", "C-01"], findings: ["G-01"], refs: ["T:seg-03", "T:seg-04", "T:seg-09"] },

  { id: "P3", name: "Credit check", actor: "Credit control", system: "Business Central",
    what: "The order is blocked automatically where exposure would exceed the customer's credit limit, and released by credit control.",
    sub: "R3", controls: ["C-02"], findings: [], refs: ["T:seg-18", "D:note-1"], contested: true },

  { id: "P4", name: "Despatch", actor: "Van Dijk Logistics", system: "Van Dijk WMS → Business Central",
    what: "Goods are picked and despatched by the logistics provider, which transmits a daily confirmation file that posts the shipment.",
    sub: "R4", controls: [], findings: ["G-02", "G-03"], refs: ["T:seg-19", "T:seg-21", "D:doc-so-11"] },

  { id: "P5", name: "Installation & acceptance", actor: "Service engineers", system: "ServiceTrack",
    what: "Machines are installed at the customer site and the customer signs an acceptance protocol. Revenue is recognised on acceptance.",
    sub: "R6", controls: [], findings: ["F-01"], refs: ["T:seg-25"] },

  { id: "P6", name: "Invoicing", actor: "Business Central", system: "Business Central (automated)",
    what: "An overnight batch raises an invoice from each posted shipment, taking quantity from the shipment and price from the order.",
    sub: "R5", controls: ["C-03", "C-04"], findings: [], refs: ["T:seg-13", "D:doc-py-3"] },

  { id: "P7", name: "Revenue posting", actor: "Financial controller", system: "Business Central GL",
    what: "The invoice posts to the revenue account. Service revenue posts from the ServiceTrack deferral schedule and is reconciled monthly.",
    sub: "R6", controls: ["C-06", "C-13", "C-12"], findings: ["G-04", "G-05"], refs: ["T:seg-24", "T:seg-35"] },

  { id: "P8", name: "Cash receipt", actor: "Credit control", system: "Business Central",
    what: "Bank statements load daily and match automatically on the payment reference. Unmatched receipts go to a suspense list.",
    sub: "R8", controls: ["C-08", "C-07"], findings: [], refs: ["T:seg-30"] },
];

/* --- Findings -------------------------------------------------------------
   The control gaps from data-model.js are findings too; these are the ones
   that are not gaps in a control but observations about the process itself.
   -------------------------------------------------------------------------- */

export const processFindings = [
  { id: "F-01", step: "P5", kind: "observation", severity: "observation",
    title: "Where signed acceptance protocols are retained was not established",
    detail: "Machine revenue is recognised on customer acceptance, so the acceptance protocol is the document that fixes the recognition date. We did not establish where the signed protocols are held, who holds them, or how the acceptance date reaches the accounting records.",
    impact: "Without a retained, dated protocol the recognition date cannot be corroborated for any machine sale.",
    refs: ["T:seg-25"], fromTrace: false },
];

/* Raised by the line walkthrough when the auditor concludes the exception. */
export const traceFinding = {
  id: "F-02", step: "P6", kind: "exception", severity: "deficiency",
  title: "Revenue invoiced and posted before the customer accepted the installation",
  detail: "On order SO-24188 the invoice was raised on 15 September 2026 and posted to revenue the same day. The customer signed the acceptance protocol on 22 September 2026. Under the entity's stated policy, machine revenue is recognised on acceptance, so revenue was recognised seven days before the performance obligation was satisfied.",
  impact: "The automated invoicing batch triggers on despatch, not on acceptance, so this is systematic rather than isolated for every machine sale where installation lags delivery. It bears directly on cut-off and on the occurrence assertion.",
  remediation: "Suppress the automated invoice for machine sales until the acceptance protocol is recorded, or defer revenue recognition on invoices raised before acceptance and clear the deferral on acceptance.",
  refs: ["LW:t5", "LW:t6", "T:seg-25", "T:seg-13"], fromTrace: true,
};

/* --- Line walkthrough ------------------------------------------------------ */

export const lineWalkCandidates = [
  { id: "SO-24188", customer: "Bakkerij Groep Nederland B.V.", value: "EUR 284,500",
    what: "PL-400 conveyor line, delivered and installed in September",
    why: "The largest machine sale in the interim period, and the only one where installation spans the reporting date — the case most likely to test the recognition policy.",
    recommended: true },
  { id: "SO-24052", customer: "Vermeulen Voeding B.V.", value: "EUR 96,200",
    what: "Two modular conveyors, delivered August",
    why: "Below the quotation approval threshold, so it exercises a different control path." },
  { id: "SO-24310", customer: "Nordvest Seafood AS", value: "EUR 31,800",
    what: "Spare parts, ordered by e-mail",
    why: "A spare-part order, which enters through the unreconciled mailbox channel." },
];

export const lineWalk = {
  transaction: lineWalkCandidates[0],
  steps: [
    { id: "t1", step: "P1", name: "Quotation",
      expectedStep: "A quotation is configured, approved above EUR 100,000 by the Commercial Director, and signed by the customer.",
      expectedControl: "C-14 — quotations above EUR 100,000 are approved before issue",
      expectedEvidence: "Signed quotation carrying the approval record",
      actualEvidence: "QUO-2026-0412, EUR 284,500, approved by B. Kuipers on 12 August 2026 and signed by the customer on 14 August 2026.",
      observation: "The quotation exceeds the threshold and carries the Commercial Director's approval before issue.",
      suggested: "corroborated" },

    { id: "t2", step: "P2", name: "Sales order",
      expectedStep: "Sales administration converts the signed quotation into a sales order carrying the quotation reference and price.",
      expectedControl: "C-11 — machine orders are created only from a customer-signed quotation",
      expectedEvidence: "Sales order referencing the quotation, at the quoted price",
      actualEvidence: "SO-24188 created 15 August 2026, references QUO-2026-0412, value EUR 284,500. No price override recorded on any line.",
      observation: "The order price agrees to the signed quotation and no override was applied.",
      suggested: "corroborated" },

    { id: "t3", step: "P3", name: "Credit check",
      expectedStep: "The order is checked against the customer's credit limit and blocked if exposure would exceed it.",
      expectedControl: "C-02 — orders exceeding the credit limit are blocked and released only by credit control",
      expectedEvidence: "Credit check record; a release log entry if the order was blocked",
      actualEvidence: "Customer limit EUR 400,000, exposure at order date EUR 311,700. No block was triggered and no release was required.",
      observation: "The control did not need to operate on this transaction. Its design was evaluated separately; this trace provides no evidence about its operation.",
      suggested: "corroborated", note: "not_triggered" },

    { id: "t4", step: "P4", name: "Despatch",
      expectedStep: "Van Dijk Logistics picks and despatches the goods and transmits a daily confirmation file that posts the shipment.",
      expectedControl: "None identified — the despatch file is not reconciled to internal records (G-02)",
      expectedEvidence: "Despatch note and the confirmation file entry posting the shipment",
      actualEvidence: "DN-88214 despatched 2 September 2026; shipment posted in Business Central from the Van Dijk file of the same evening. Quantities agree to the order.",
      observation: "The despatch posted correctly on this transaction. Because no reconciliation is performed, this trace does not evidence that the file is complete generally.",
      suggested: "corroborated" },

    { id: "t5", step: "P5", name: "Installation & acceptance",
      expectedStep: "The machine is installed and the customer signs an acceptance protocol. Revenue is recognised on acceptance.",
      expectedControl: "None identified — retention of the acceptance protocol was not established (F-01)",
      expectedEvidence: "Acceptance protocol, signed and dated by the customer",
      actualEvidence: "Acceptance protocol ACC-24188, signed by the customer's plant manager on 22 September 2026. Obtained from the project file on request; it is not held in ServiceTrack or Business Central.",
      observation: "The customer accepted the installation on 22 September. The invoice for this order is dated 15 September — seven days earlier.",
      suggested: "exception",
      exception: "Revenue was recognised before the performance obligation was satisfied. Under the entity's stated policy machine revenue is recognised on acceptance, and the acceptance protocol post-dates the invoice and the revenue posting by seven days.",
      why: "comparing the acceptance date on the protocol with the invoice date already captured at step 6 of this trace." },

    { id: "t6", step: "P6", name: "Invoicing",
      expectedStep: "The overnight batch raises an invoice from the posted shipment, taking quantity from the shipment and price from the order.",
      expectedControl: "C-03 — invoices are generated automatically from the posted shipment without re-keying",
      expectedEvidence: "Invoice linked to the shipment, priced from the order",
      actualEvidence: "INV-2026-11902 dated 15 September 2026, EUR 284,500, generated automatically from shipment DN-88214. Price and quantity agree to the order and the despatch.",
      observation: "The invoice was generated as described and agrees to the order and despatch. The control operated. The batch triggers on despatch, not on acceptance, which is what produced the exception at step 5.",
      suggested: "corroborated" },

    { id: "t7", step: "P7", name: "Revenue posting",
      expectedStep: "The invoice posts to the revenue account in the general ledger.",
      expectedControl: "C-06 — the revenue account is reconciled to the billing sub-ledger monthly",
      expectedEvidence: "General ledger entry agreeing to the invoice",
      actualEvidence: "Posted to account 8000 (Revenue — machines) on 15 September 2026, EUR 284,500, journal reference SL-09-11902.",
      observation: "The ledger entry agrees to the invoice in amount and date.",
      suggested: "corroborated" },
  ],
  notApplicable: {
    step: "P8", name: "Cash receipt",
    why: "The invoice falls due on 15 October 2026 and was unpaid at the date of this walkthrough. Cash receipt cannot be traced for this transaction.",
  },
};

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
  priorYearNote: "The control was tested in the FY2025 audit and found effective. ISA 330 permits using evidence from a previous audit for an unchanged control, provided it is tested at least once in every third audit — a decision for the auditor, not applied automatically.",
};
