/* ============================================================================
   data-sources.js — the evidence base.

   Everything the engine would have ingested: a walkthrough transcript, a client
   questionnaire, three documents and one set of auditor notes. Every generated
   claim elsewhere in the prototype points into this file by evidence id, the
   same way `EvidenceRef` in packages/domain points at a segment or a chunk.

   Fictional client. No real entity, person or engagement is depicted.
   ========================================================================== */

export const firm = {
  name: "Kuyper & Bergman Accountants",
  packName: "revenue",
  packVersion: "0.1.0",
  methodology: "K&B Audit Methodology 2026.1",
};

export const user = { name: "Sanne Bakker", role: "Audit senior", initials: "SB" };

export const client = {
  id: "CL-0142",
  name: "Vandersteen Industrial Systems B.V.",
  short: "Vandersteen",
  seat: "Eindhoven, Netherlands",
  sector: "Industrial machinery — conveyor and material-handling systems for food processing",
  framework: "EU-IFRS",
  employees: 184,
  fy: "FY2026",
  yearEnd: "31 December 2026",
  since: "Client since 2019",
  revenuePY: "48.6",
  streams: [
    { name: "Machines and spare parts", amount: "41.2", basis: "Point in time — on customer acceptance" },
    { name: "Service and maintenance contracts", amount: "7.4", basis: "Over time — straight-line over the contract term" },
  ],
  systems: [
    { name: "Microsoft Dynamics 365 Business Central", role: "Quotation, order, shipment, invoice, general ledger" },
    { name: "ServiceTrack", role: "Service contracts, field service, deferral schedule" },
    { name: "Van Dijk Logistics WMS", role: "Warehousing and despatch (outsourced since March 2026)" },
  ],
  contacts: [
    { name: "Ruud Timmermans", role: "Financial Controller", tag: "Walkthrough participant" },
    { name: "Bas Kuipers", role: "Commercial Director", tag: "Questionnaire completed" },
    { name: "Ingrid Molenaar", role: "Credit Control", tag: "Follow-up call held" },
    { name: "Fatima El Amrani", role: "Sales Administration lead", tag: "Not yet contacted" },
    { name: "Pieter Halsema", role: "IT Manager", tag: "Evidence requested" },
    { name: "Marc de Wit", role: "Chief Financial Officer", tag: "" },
  ],
};

export const engagement = {
  id: "ENG-2026-0142",
  title: "FY2026 statutory audit — Vandersteen Industrial Systems B.V.",
  period: "1 January 2026 – 31 December 2026",
  interimAt: "Interim as at 30 September 2026",
  materiality: "EUR 620,000 (performance materiality EUR 415,000)",
  team: [
    { name: "Marieke de Groot RA", role: "Engagement partner", initials: "MG" },
    { name: "Sander Willemsen RA", role: "Manager", initials: "SW" },
    { name: "Sanne Bakker", role: "Senior — in charge", initials: "SB" },
    { name: "Tim Vos", role: "Assistant", initials: "TV" },
  ],
  phases: [
    { id: "planning", name: "Planning", state: "Complete", detail: "Signed 4 July 2026" },
    { id: "interim", name: "Interim", state: "In progress", detail: "Revenue active · 5 processes not started" },
    { id: "final", name: "Final", state: "Not started", detail: "Planned from 12 January 2027" },
    { id: "completion", name: "Completion", state: "Not started", detail: "" },
  ],
  processes: [
    { id: "revenue", name: "Revenue / order-to-cash", state: "active" },
    { id: "purchases", name: "Purchases and payables", state: "later" },
    { id: "payroll", name: "Payroll", state: "later" },
    { id: "inventory", name: "Inventory", state: "later" },
    { id: "cash", name: "Cash and treasury", state: "later" },
    { id: "itgc", name: "IT general controls", state: "later" },
  ],
};

/* --- Sources --------------------------------------------------------------- */

export const sources = {
  "SRC-1": {
    id: "SRC-1", kind: "transcript", short: "T",
    name: "Revenue walkthrough — transcript",
    detail: "18 September 2026, 09:30 · 52 minutes · imported from Microsoft Teams (VTT)",
    participants: "Ruud Timmermans (Financial Controller) · Sanne Bakker (Audit senior)",
    ingest: "Indexed · 38 segments · 6,240 words",
  },
  "SRC-2": {
    id: "SRC-2", kind: "client_answer", short: "Q",
    name: "Client questionnaire — commercial",
    detail: "Completed 15 September 2026 by Bas Kuipers (Commercial Director)",
    participants: "12 of 14 questions answered",
    ingest: "Indexed · 12 answers",
  },
  "SRC-3": {
    id: "SRC-3", kind: "prior_year", short: "PY",
    name: "FY2025 revenue process narrative",
    detail: "Approved working paper, 12 February 2026 · 9 pages",
    participants: "Prepared by J. Aarts · reviewed by S. Willemsen RA",
    ingest: "Indexed · 9 pages · 31 chunks",
  },
  "SRC-4": {
    id: "SRC-4", kind: "document", short: "AL",
    name: "Business Central access listing — pricing and customer master data",
    detail: "Extracted 12 September 2026 by P. Halsema (IT Manager) · 3 pages",
    participants: "Requested as part of walkthrough preparation",
    ingest: "Indexed · 3 pages",
  },
  "SRC-5": {
    id: "SRC-5", kind: "document", short: "SO",
    name: "Van Dijk Logistics — ISAE 3402 Type II report FY2025",
    detail: "Service organisation report · 34 pages · period to 31 December 2025",
    participants: "Provided by the client 2 September 2026",
    ingest: "Indexed · 34 pages · 96 chunks",
  },
  "SRC-6": {
    id: "SRC-6", kind: "auditor_input", short: "N",
    name: "Auditor notes — cut-off and credit control",
    detail: "Call with Ingrid Molenaar (Credit Control), 19 September 2026",
    participants: "Recorded by S. Bakker",
    ingest: "Indexed · 1 note",
  },
};

/* --- Transcript ------------------------------------------------------------ */

const A = "Sanne Bakker", AR = "Audit senior";
const R = "Ruud Timmermans", RR = "Financial Controller";

export const transcript = [
  { id: "seg-01", t: "00:40", who: A, role: AR, text: "Thanks for the time. I would like to follow a sale from the point the customer places an order all the way to the revenue line in the ledger, and understand where the controls sit. Can we start with what you actually sell?" },
  { id: "seg-02", t: "01:35", who: R, role: RR, text: "Two streams. Machines and spare parts, that is about forty-one million, and service contracts, around seven and a half. The service side has grown a lot since we bought the maintenance business in 2024." },
  { id: "seg-03", t: "03:20", who: R, role: RR, text: "Machine orders start as a quotation from the sales engineers, built in the configurator in Business Central. The customer signs it and sales administration converts the quotation into a sales order. Spare parts come in by email and through the webshop. Service is different, that runs in ServiceTrack." },
  { id: "seg-04", t: "04:55", who: R, role: RR, text: "For spare parts, if an email never gets keyed we would hear about it from the customer. There is no reconciliation between the mailbox and the orders in the system." },
  { id: "seg-05", t: "06:15", who: R, role: RR, text: "Sales administration creates the customer record. Fatima's team. They need a Chamber of Commerce extract and a VAT number before they can open the account." },
  { id: "seg-06", t: "06:48", who: A, role: AR, text: "Does anybody outside sales administration approve a new customer before it is opened?" },
  { id: "seg-07", t: "07:02", who: R, role: RR, text: "Not formally, no. It is meant to be a four-eyes thing within the team, but I could not show you evidence that it happened on any particular account." },
  { id: "seg-08", t: "08:30", who: R, role: RR, text: "Machine prices come off the signed quotation. Spare parts take the price from the customer price list in Business Central — each trade customer has an agreed list and there is a standard list for everyone else." },
  { id: "seg-09", t: "09:40", who: R, role: RR, text: "Sales can change the line price on an order. There is a mandatory reason code, and Business Central logs who changed it. There is a price override report you can run out of the system." },
  { id: "seg-10", t: "10:20", who: A, role: AR, text: "Who reviews that report?" },
  { id: "seg-11", t: "10:31", who: R, role: RR, text: "I do not think anyone runs it monthly. It is not on anyone's list as far as I know." },
  { id: "seg-12", t: "11:05", who: R, role: RR, text: "Anything over twelve per cent discount blocks the order until Bas releases it. That is a hard block in the system and it has been there since we went live." },
  { id: "seg-13", t: "12:04", who: R, role: RR, text: "Business Central raises the invoice automatically overnight from the posted shipment. Quantity comes from the shipment, price from the order. Nobody re-keys anything." },
  { id: "seg-14", t: "13:30", who: R, role: RR, text: "Finance can raise a manual invoice — for a settlement, or a milestone on a large project. That needs my approval before it goes out." },
  { id: "seg-15", t: "15:10", who: R, role: RR, text: "Ingrid in credit control sets the limits. She uses a Graydon report and the payment history on the account." },
  { id: "seg-16", t: "15:48", who: A, role: AR, text: "Can anybody change a credit limit outside credit control?" },
  { id: "seg-17", t: "16:02", who: R, role: RR, text: "No. It is Ingrid, and above two hundred and fifty thousand it needs the CFO to agree." },
  { id: "seg-18", t: "17:20", who: R, role: RR, text: "If an order breaches the limit the system blocks it and only credit control can release it. There is a log of the releases in Business Central." },
  { id: "seg-19", t: "19:00", who: R, role: RR, text: "Since March, Van Dijk Logistics runs the warehouse for us. They pick, pack and ship, and they send a despatch file every evening that posts the shipments in Business Central." },
  { id: "seg-20", t: "20:15", who: A, role: AR, text: "What happens if that file arrives but is incomplete?" },
  { id: "seg-21", t: "20:28", who: R, role: RR, text: "If the file fails to load we get an error and IT picks it up. If it loads but is short a few lines, I am honestly not sure we would pick that up." },
  { id: "seg-22", t: "21:40", who: R, role: RR, text: "There is a standard delivered-not-invoiced report in Business Central. We do not run it." },
  { id: "seg-23", t: "24:10", who: R, role: RR, text: "Service contracts are billed quarterly in advance and recognised straight-line over the contract period. ServiceTrack holds the contract and posts the deferral schedule into Business Central every month." },
  { id: "seg-24", t: "25:30", who: R, role: RR, text: "The ServiceTrack to Business Central interface runs nightly and Pieter's team gets an alert if it fails. I reconcile the service revenue account at month end." },
  { id: "seg-25", t: "28:00", who: R, role: RR, text: "Machines are recognised when they are installed and the customer signs the acceptance protocol. For a straightforward conveyor that is the same week as delivery; for a full line it can be six weeks later." },
  { id: "seg-26", t: "30:20", who: R, role: RR, text: "Sales administration raises the credit note, the sales manager approves it, and it has to reference the original invoice." },
  { id: "seg-27", t: "32:00", who: R, role: RR, text: "Three OEM customers have volume rebates. I calculate the accrual at month end from the contract terms and the year-to-date volume." },
  { id: "seg-28", t: "32:40", who: A, role: AR, text: "Does anyone review that calculation?" },
  { id: "seg-29", t: "32:49", who: R, role: RR, text: "Not really. It is my spreadsheet." },
  { id: "seg-30", t: "35:15", who: R, role: RR, text: "Bank statements load daily and match automatically on the payment reference. Anything unmatched goes to a suspense list and Ingrid clears it. The ageing is reviewed monthly with Marc." },
  { id: "seg-31", t: "37:00", who: R, role: RR, text: "A write-off above ten thousand euro needs the CFO to approve it." },
  { id: "seg-32", t: "39:30", who: R, role: RR, text: "At the end of the month I look at the shipments in the last few days either side of the cut-off and check the invoice dates line up." },
  { id: "seg-33", t: "40:10", who: A, role: AR, text: "Is that documented anywhere?" },
  { id: "seg-34", t: "40:18", who: R, role: RR, text: "No. It is something I do." },
  { id: "seg-35", t: "43:00", who: R, role: RR, text: "Manual journals to revenue accounts — that is me or Marc. We approve each other's." },
  { id: "seg-36", t: "46:00", who: R, role: RR, text: "The sales engineers get commission on invoiced revenue. Bas has a turnover component in his bonus. And we have an EBITDA covenant with the bank that is tested half-yearly." },
  { id: "seg-37", t: "48:20", who: R, role: RR, text: "I review revenue and gross margin by stream against budget every month and go through it with Marc. I chase anything over about two hundred and fifty thousand." },
  { id: "seg-38", t: "49:40", who: R, role: RR, text: "Fatima's team can change customer master data and the price lists, and Pieter could as well. There is no periodic review of who holds that access." },
];

/* --- Client questionnaire -------------------------------------------------- */

export const questionnaire = [
  { n: 1, coverage: "R1.4", q: "Which kinds of revenue does the company have, and roughly how large is each?",
    a: "Machines and spare parts, and service contracts. Machines are much the larger part. Service has been growing since 2024.", state: "answered" },
  { n: 2, coverage: "R2.2", q: "Who signs off a quotation before it goes to the customer?",
    a: "I do, for anything above a hundred thousand. Below that the sales engineer sends it directly.", state: "answered" },
  { n: 3, coverage: "R2.2", q: "Who can give a discount, and up to what level?",
    a: "Sales engineers up to twelve per cent. Above that it comes to me and the system blocks the order until I release it.", state: "answered" },
  { n: 4, coverage: "R1.3", q: "Are there customer arrangements outside your standard terms — consignment, bill-and-hold, a right of return, or side letters?",
    a: "Two OEM customers have volume rebate agreements. One distributor in Germany holds stock on consignment at their own site.", state: "answered", flag: "new_topic" },
  { n: 5, coverage: "R1.1", q: "Who approves a new customer before the account is opened?",
    a: "Sales administration sets them up. I see the bigger ones.", state: "answered" },
  { n: 6, coverage: "R3.1", q: "Can a customer's credit limit be changed, and by whom?",
    a: "Credit control sets them, but I can raise a limit up to fifty thousand myself if an order is stuck and I know the customer.", state: "answered", flag: "contradiction" },
  { n: 7, coverage: "R2.3", q: "What happens when an order is blocked because of credit?",
    a: "It sits in the blocked list until credit control releases it. Sometimes I chase them.", state: "answered" },
  { n: 8, coverage: "R10.4", q: "Who maintains the customer price lists?",
    a: "Sales administration maintain them. I approve the annual price increase.", state: "answered" },
  { n: 9, coverage: "R11.3", q: "Are sales staff targets or bonuses linked to revenue?",
    a: "Commission on invoiced revenue for the engineers, and I have a turnover component in my own bonus.", state: "answered" },
  { n: 10, coverage: "R7.1", q: "Who can approve a credit note?",
    a: "The sales manager. For big ones I would expect finance to look at it.", state: "answered", flag: "vague" },
  { n: 11, coverage: "R7.2", q: "What is your returns policy?",
    a: "We do not take machines back. Spare parts occasionally, within thirty days, but it almost never happens.", state: "answered" },
  { n: 12, coverage: "R6.4", q: "Do you sell through agents, or on a bill-and-hold basis?",
    a: "No agents. No bill-and-hold.", state: "answered" },
  { n: 13, coverage: "R5.3", q: "Who reviews the price override report, and how often?",
    a: null, state: "sent", sentOn: "20 September 2026", origin: "deterministic_trigger" },
  { n: 14, coverage: "R9.3", q: "How is the consignment stock at the German distributor treated at period end — when is revenue recognised on it?",
    a: null, state: "sent", sentOn: "20 September 2026", origin: "model_proposed" },
];

/* --- Document excerpts ------------------------------------------------------ */

export const docExcerpts = [
  { id: "doc-py-3", src: "SRC-3", loc: "p. 3", text: "Invoices are raised automatically from the posted shipment. No manual intervention occurs in the standard order-to-invoice flow." },
  { id: "doc-py-5", src: "SRC-3", loc: "p. 5", text: "Credit notes are raised by sales administration and approved by the sales manager. The credit note references the original invoice number." },
  { id: "doc-py-7", src: "SRC-3", loc: "p. 7", text: "Warehouse operations, including picking and despatch, are performed in-house at the Eindhoven site." },
  { id: "doc-al-1", src: "SRC-4", loc: "p. 1", text: "Permission set SALES-PRICE-MOD (Price List – Modify): 14 users. Permission set CUST-CARD-MOD (Customer Card – Modify): 9 users, including two IT service accounts." },
  { id: "doc-so-11", src: "SRC-5", loc: "p. 11", text: "Complementary user entity control: the user entity is responsible for reconciling the daily despatch confirmation file received from Van Dijk Logistics to its own order and shipment records." },
  { id: "doc-so-4", src: "SRC-5", loc: "p. 4", text: "The scope of this report covers warehousing, picking, packing and despatch services performed at the Tilburg distribution centre for the period 1 January 2025 to 31 December 2025." },
  { id: "note-1", src: "SRC-6", loc: "note 1", text: "Ingrid Molenaar confirmed that she sets and changes all credit limits and keeps a log of block releases. She stated she was not aware of anyone outside credit control being able to change a limit." },
  { id: "note-2", src: "SRC-6", loc: "note 2", text: "Ingrid Molenaar confirmed there is no written cut-off procedure and that the month-end shipment review is performed by the financial controller alone." },
];

/* --- Evidence registry -----------------------------------------------------
   Every generated object elsewhere refers to one of these ids. This is the
   prototype's stand-in for `EvidenceRef` + the provenance index.
   -------------------------------------------------------------------------- */

function fromTranscript(seg) {
  return {
    id: `T:${seg.id}`, kind: "transcript", sourceId: "SRC-1",
    short: `T ${seg.t}`, locator: `18 Sep · ${seg.t}`,
    sourceName: "Revenue walkthrough transcript",
    speaker: `${seg.who} (${seg.role})`,
    quote: seg.text, segId: seg.id,
  };
}

function fromQuestion(q) {
  return {
    id: `Q:${q.n}`, kind: "client_answer", sourceId: "SRC-2",
    short: `Q ${q.n}`, locator: `Question ${q.n}`,
    sourceName: "Client questionnaire — B. Kuipers",
    speaker: "Bas Kuipers (Commercial Director)",
    quote: q.a || "(not yet answered)", question: q.q,
  };
}

function fromDoc(d) {
  const s = sources[d.src];
  return {
    id: `D:${d.id}`, kind: s.kind, sourceId: d.src,
    short: `${s.short} ${d.loc.replace("p. ", "p.")}`, locator: d.loc,
    sourceName: s.name, speaker: "", quote: d.text,
  };
}

export const evidence = {};
transcript.forEach((s) => { evidence[`T:${s.id}`] = fromTranscript(s); });
questionnaire.forEach((q) => { if (q.a) evidence[`Q:${q.n}`] = fromQuestion(q); });
docExcerpts.forEach((d) => { evidence[`D:${d.id}`] = fromDoc(d); });

/** Mark the two refs that sit either side of the credit-limit contradiction. */
evidence["T:seg-17"].conflict = true;
evidence["Q:6"].conflict = true;

/* --- Evidence created during the session ------------------------------------
   A questionnaire answer submitted now is a source like any other. It has to
   enter the evidence registry, not sit in a private fact override, or a
   statement that later rests on it has no provenance to show.
   -------------------------------------------------------------------------- */

export const sessionEvidence = {};

/** Register a submitted questionnaire answer as evidence. Returns its id. */
export function recordAnswerEvidence(q, text, submittedAt) {
  const id = `Q:${q.n}`;
  sessionEvidence[id] = {
    id, kind: "client_answer", sourceId: "SRC-2",
    short: `Q ${q.n}`, locator: `Question ${q.n} · answered ${submittedAt}`,
    sourceName: "Client questionnaire — B. Kuipers",
    speaker: "Bas Kuipers (Commercial Director)",
    question: q.q, quote: text,
    submittedAt, thisSession: true,
  };
  return id;
}

export function clearSessionEvidence() {
  Object.keys(sessionEvidence).forEach((k) => delete sessionEvidence[k]);
}

/** Session evidence wins: an answer given now supersedes the unanswered stub. */
export const ref = (id) => sessionEvidence[id] || evidence[id] || null;
export const refs = (ids) => ids.map(ref).filter(Boolean);
