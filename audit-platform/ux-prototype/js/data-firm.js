/* ============================================================================
   data-firm.js — the setup layer above the engagement.

   Three kinds of people, deliberately kept apart:

     FirmUser       a colleague at the audit firm who uses Audit AI
     ClientContact  a person at the audited entity — NOT a platform account
     ClientAccess   a contact given limited access for one task (a questionnaire)

   Conflating those three is the mistake this file exists to prevent. A firm
   user has an audit role AND a software access level; a client contact has a
   professional title and nothing else; access is granted per task and is not
   an account.

   This is seed data. Everything here is copied into session state at boot so
   the prototype can create clients and engagements without a backend — see
   `state.js` → `initial()`.
   ========================================================================== */

/* --- Vocabulary ------------------------------------------------------------
   Audit role and software permission are different axes and must not be
   flattened into one list.
   -------------------------------------------------------------------------- */

export const AUDIT_ROLES = ["Partner", "Manager", "Senior", "Assistant"];
export const ACCESS_LEVELS = ["Member", "Admin"];
export const ENGAGEMENT_TYPES = ["Statutory audit", "Voluntary audit"];
export const FRAMEWORKS = ["EU-IFRS", "Dutch GAAP", "IFRS for SMEs", "US GAAP"];
export const COUNTRIES = ["Netherlands", "Belgium", "Germany", "Luxembourg", "France"];
export const PARTICIPANT_ROLES = [
  "Walkthrough participant", "Questionnaire participant",
  "Follow-up contact", "Evidence provider", "Not yet contacted",
];

/* --- Firm people -----------------------------------------------------------
   Colleagues. Every one carries BOTH an audit role and an access level.
   -------------------------------------------------------------------------- */

export const firmUsers = [
  { id: "FU-01", name: "Marieke de Groot RA", role: "Partner", access: "Admin",
    email: "m.degroot@kuyperbergman.nl", joined: "2011" },
  { id: "FU-02", name: "Sander Willemsen RA", role: "Manager", access: "Member",
    email: "s.willemsen@kuyperbergman.nl", joined: "2017" },
  { id: "FU-03", name: "Sanne Bakker", role: "Senior", access: "Member",
    email: "s.bakker@kuyperbergman.nl", joined: "2022", isMe: true },
  { id: "FU-04", name: "Tim Vos", role: "Assistant", access: "Member",
    email: "t.vos@kuyperbergman.nl", joined: "2025" },
  { id: "FU-05", name: "Anne de Vries RA", role: "Partner", access: "Admin",
    email: "a.devries@kuyperbergman.nl", joined: "2009" },
  { id: "FU-06", name: "Milan Jansen", role: "Assistant", access: "Member",
    email: "m.jansen@kuyperbergman.nl", joined: "2026" },
  { id: "FU-07", name: "Joost Prins", role: "Manager", access: "Admin",
    email: "j.prins@kuyperbergman.nl", joined: "2020" },
];

/* --- The process catalogue -------------------------------------------------
   What a firm can put in scope for interim. `workflow` names the only process
   the prototype has a methodology pack and evidence for.
   -------------------------------------------------------------------------- */

export const processCatalogue = [
  { id: "revenue",   name: "Revenue / order-to-cash", blurb: "Quotation to cash receipt", workflow: "revenue" },
  { id: "purchases", name: "Purchasing",              blurb: "Purchase-to-pay",           workflow: null },
  { id: "payroll",   name: "Payroll",                 blurb: "Hire-to-retire",            workflow: null },
  { id: "inventory", name: "Inventory",               blurb: "Stock and costing",         workflow: null },
  { id: "treasury",  name: "Treasury",                blurb: "Cash and financing",        workflow: null },
  { id: "close",     name: "Financial close",         blurb: "Close and reporting",       workflow: null },
];

export const PHASES = [
  { id: "planning",   name: "Planning" },
  { id: "interim",    name: "Interim" },
  { id: "final",      name: "Final" },
  { id: "completion", name: "Completion" },
];

/* --- Clients ---------------------------------------------------------------
   Contacts and systems live HERE, at client level, not on the engagement and
   not on the process. Prepare consumes them; it does not own them.
   -------------------------------------------------------------------------- */

export const clients = [
  {
    id: "CL-0142",
    name: "Vandersteen Industrial Systems B.V.",
    short: "Vandersteen",
    country: "Netherlands", city: "Eindhoven",
    sector: "Industrial machinery — conveyor and material-handling systems for food processing",
    sectorShort: "Industrial machinery",
    framework: "EU-IFRS",
    yearEnd: "31 December",
    since: "2019",
    acceptance: "Completed",
    employees: 184,
    contacts: [
      { id: "CC-01", name: "Ruud Timmermans", role: "Financial Controller",
        email: "r.timmermans@vandersteen.nl", department: "Finance" },
      { id: "CC-02", name: "Bas Kuipers", role: "Commercial Director",
        email: "b.kuipers@vandersteen.nl", department: "Commercial" },
      { id: "CC-03", name: "Ingrid Molenaar", role: "Credit Control",
        email: "i.molenaar@vandersteen.nl", department: "Finance" },
      { id: "CC-04", name: "Fatima El Amrani", role: "Sales Administration lead",
        email: "f.elamrani@vandersteen.nl", department: "Commercial" },
      { id: "CC-05", name: "Pieter Halsema", role: "IT Manager",
        email: "p.halsema@vandersteen.nl", department: "IT" },
      { id: "CC-06", name: "Marc de Wit", role: "Chief Financial Officer",
        email: "m.dewit@vandersteen.nl", department: "Finance" },
    ],
    systems: [
      { id: "SY-01", name: "Microsoft Dynamics 365 Business Central",
        role: "Quotation, order, shipment, invoice, general ledger", owner: "P. Halsema" },
      { id: "SY-02", name: "ServiceTrack",
        role: "Service contracts, field service, deferral schedule", owner: "P. Halsema" },
      { id: "SY-03", name: "Van Dijk Logistics WMS",
        role: "Warehousing and despatch", owner: "Van Dijk Logistics",
        note: "Outsourced since March 2026 — service organisation" },
    ],
  },
  {
    id: "CL-0187",
    name: "Meerveld Zorggroep",
    short: "Meerveld",
    country: "Netherlands", city: "Utrecht",
    sector: "Healthcare — residential and home care",
    sectorShort: "Healthcare",
    framework: "Dutch GAAP",
    yearEnd: "31 December",
    since: "2023",
    acceptance: "Completed",
    employees: 640,
    contacts: [
      { id: "CC-11", name: "Willem Hoekstra", role: "Finance Director",
        email: "w.hoekstra@meerveld.nl", department: "Finance" },
    ],
    systems: [
      { id: "SY-11", name: "AFAS Profit", role: "Financial and HR administration", owner: "" },
    ],
  },
  {
    id: "CL-0103",
    name: "Brekelmans Bouw B.V.",
    short: "Brekelmans",
    country: "Netherlands", city: "Tilburg",
    sector: "Construction — commercial and industrial building",
    sectorShort: "Construction",
    framework: "Dutch GAAP",
    yearEnd: "31 December",
    since: "2015",
    acceptance: "Completed",
    employees: 96,
    contacts: [
      { id: "CC-21", name: "Karin Brekelmans", role: "Managing Director",
        email: "k.brekelmans@brekelmans.nl", department: "Board" },
    ],
    systems: [
      { id: "SY-21", name: "Exact Online", role: "Financial administration", owner: "" },
    ],
  },
];

/* --- Engagements -----------------------------------------------------------
   One per client per financial year. `canonical: true` marks the one the
   prototype has a methodology pack, a transcript and evidence for — the only
   one whose Revenue workflow can actually run.
   -------------------------------------------------------------------------- */

export const engagements = [
  {
    id: "ENG-2026-0142", clientId: "CL-0142", canonical: true,
    fy: "FY2026", periodStart: "1 January 2026", periodEnd: "31 December 2026",
    type: "Statutory audit", framework: "EU-IFRS",
    materiality: "EUR 620,000", performanceMateriality: "EUR 415,000",
    interimAt: "Interim as at 30 September 2026",
    phase: "interim",
    phaseDetail: { planning: "Signed 4 July 2026", interim: "", final: "From 12 January 2027", completion: "" },
    team: [
      { userId: "FU-01", role: "Partner" },
      { userId: "FU-02", role: "Manager" },
      { userId: "FU-03", role: "Senior" },
      { userId: "FU-04", role: "Assistant" },
    ],
    processes: ["revenue", "purchases", "payroll", "inventory", "treasury", "close"],
  },
  {
    id: "ENG-2025-0142", clientId: "CL-0142",
    fy: "FY2025", periodStart: "1 January 2025", periodEnd: "31 December 2025",
    type: "Statutory audit", framework: "EU-IFRS",
    materiality: "EUR 580,000", performanceMateriality: "EUR 390,000",
    phase: "complete",
    phaseDetail: { planning: "", interim: "", final: "", completion: "Opinion signed 12 February 2026" },
    team: [{ userId: "FU-01", role: "Partner" }, { userId: "FU-02", role: "Manager" }],
    processes: ["revenue", "purchases", "payroll"],
  },
  {
    id: "ENG-2026-0187", clientId: "CL-0187",
    fy: "FY2026", periodStart: "1 January 2026", periodEnd: "31 December 2026",
    type: "Statutory audit", framework: "Dutch GAAP",
    materiality: "EUR 410,000", performanceMateriality: "EUR 275,000",
    phase: "planning",
    phaseDetail: { planning: "In progress", interim: "", final: "", completion: "" },
    team: [{ userId: "FU-05", role: "Partner" }, { userId: "FU-07", role: "Manager" }],
    processes: ["revenue", "payroll"],
  },
  {
    id: "ENG-2025-0103", clientId: "CL-0103",
    fy: "FY2025", periodStart: "1 January 2025", periodEnd: "31 December 2025",
    type: "Voluntary audit", framework: "Dutch GAAP",
    materiality: "EUR 210,000", performanceMateriality: "EUR 140,000",
    phase: "complete",
    phaseDetail: { planning: "", interim: "", final: "", completion: "Signed 22 May 2026" },
    team: [{ userId: "FU-05", role: "Partner" }, { userId: "FU-03", role: "Senior" }],
    processes: ["revenue", "inventory"],
  },
];

/* --- Which client contacts are relevant to which process -------------------
   Seeded for the canonical engagement so the demo opens populated. Keyed
   `engagementId::processId`, because a person can be a walkthrough participant
   on Revenue and irrelevant to Payroll.
   -------------------------------------------------------------------------- */

export const processParticipants = {
  "ENG-2026-0142::revenue": [
    { contactId: "CC-01", role: "Walkthrough participant" },
    { contactId: "CC-02", role: "Questionnaire participant" },
    { contactId: "CC-03", role: "Follow-up contact" },
    { contactId: "CC-05", role: "Evidence provider" },
    { contactId: "CC-04", role: "Not yet contacted" },
  ],
};

export const processSystems = {
  "ENG-2026-0142::revenue": ["SY-01", "SY-02", "SY-03"],
};

/** Who the Revenue questionnaire is assigned to. A task-scoped grant, not an
 *  account: the contact can open one questionnaire and nothing else. */
export const questionnaireAssignments = {
  "ENG-2026-0142::revenue": { contactId: "CC-02", assignedOn: "20 September 2026", state: "sent" },
};

/* --- Helpers --------------------------------------------------------------- */

export const fyFromPeriodEnd = (s) => {
  const m = String(s).match(/(19|20)\d{2}/);
  return m ? `FY${m[0]}` : "";
};

export const roleRank = (r) => AUDIT_ROLES.indexOf(r);
export const nextId = (prefix, existing) =>
  `${prefix}-${String(existing.length + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 5)}`;
