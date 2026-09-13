/* ============================================================================
   data-client.js — the client-facing layer.

   The auditor product is complicated because auditing is. The client side
   answers four questions and nothing else:

       What do you need from me?
       Why are you asking?
       What should I do next?
       Am I done?

   So this file holds a task inbox, not a workflow engine. A ClientTask is a
   request from the audit team to one named person at the client, with a state
   and a place to go. There is no methodology here, no coverage, no control and
   no assertion — by design, and the client-secrecy test enforces it.

   Everything is seed data, copied into session state at boot.
   ========================================================================== */

/* --- Task types -------------------------------------------------------------
   Four, and only four. Each maps to a surface that already exists or is one
   screen long.
   -------------------------------------------------------------------------- */
export const TASK_TYPES = ["questionnaire", "live_interview", "follow_up", "document_request"];

/* Plain-language states. No open item, no coverage gap, no contradiction. */
export const TASK_STATES = {
  not_started: { label: "Not started", tone: "" },
  in_progress: { label: "In progress", tone: "accent" },
  scheduled:   { label: "Scheduled", tone: "" },
  ready:       { label: "Ready to join", tone: "accent" },
  waiting:     { label: "With your auditor", tone: "" },
  completed:   { label: "Completed", tone: "ok" },
};

/* --- The tasks --------------------------------------------------------------
   Assigned per contact, because a questionnaire sent to the commercial
   director is not the financial controller's to answer. The portal shows one
   person their own tasks and nobody else's.
   -------------------------------------------------------------------------- */
export const clientTasks = [
  {
    id: "CT-01", engagementId: "ENG-2026-0142", processId: "revenue", contactId: "CC-02",
    type: "questionnaire",
    title: "Revenue questionnaire",
    why: "A few questions about how sales get recorded, so we understand the process before we ask you to explain it.",
    due: "Friday 18 September",
    href: "#/portal/questionnaire",
    cta: "Continue",
  },
  {
    id: "CT-02", engagementId: "ENG-2026-0142", processId: "revenue", contactId: "CC-01",
    type: "live_interview",
    title: "Revenue process interview",
    why: "We will ask you to explain how the revenue process works in practice. You do not need to prepare a presentation.",
    when: "Thursday 17 September · 10:00 – 10:30",
    minutes: 30,
    withUserId: "FU-03",
    href: "#/portal/interview",
    cta: "View interview",
    topics: [
      "how orders are received",
      "how credit is checked",
      "how goods are delivered",
      "how invoices and revenue are recorded",
    ],
  },
  {
    id: "CT-03", engagementId: "ENG-2026-0142", processId: "revenue", contactId: "CC-02",
    type: "document_request",
    title: "Price override report",
    why: "Please share one recent example of the price override report from Business Central.",
    due: "Friday 18 September",
    href: "#/portal/document",
    cta: "Upload",
  },
  {
    /* Created by the interview: the controller's answer about credit limits
       does not match what the commercial director told us, so we go back to
       the commercial director. It only appears once the interview has run. */
    id: "CT-04", engagementId: "ENG-2026-0142", processId: "revenue", contactId: "CC-02",
    type: "follow_up",
    title: "One more question about credit limits",
    why: "Something came up in the interview with your colleague and we would like your side of it.",
    afterInterview: true,
    href: "#/portal/follow-up",
    cta: "Answer",
  },
  {
    id: "CT-00", engagementId: "ENG-2026-0142", processId: "revenue", contactId: "CC-02",
    type: "questionnaire",
    title: "Prior-year follow-up",
    why: "Two points carried over from last year's audit.",
    done: "Completed 3 September",
    state: "completed",
    href: null,
  },
];

/* --- The one follow-up question --------------------------------------------
   Reuses the questionnaire's question surface, not its data — the auditor's
   questionnaire keeps its own state and this does not touch it.
   -------------------------------------------------------------------------- */
export const followUpQuestion = {
  id: "FQ-01",
  q: "When an order is blocked on credit, can you release it yourself?",
  why: "Your colleague described the limits differently, and we would rather ask than assume.",
};

/* --- The live interview ----------------------------------------------------
   ONE interview, read by two very different screens. The auditor cockpit and
   the client participant view both read `S.interview` — advancing a turn on
   either side advances it on the other, because there is only one of them.

   PROTOTYPE ONLY. There is no WebRTC, no microphone, no camera, no recording
   and no transcription. `mic` and `recording` below are UX states with nothing
   behind them, and the transcript is the scripted one in data-sources.js.
   -------------------------------------------------------------------------- */
export const interviewSeed = {
  id: "IV-01",
  engagementId: "ENG-2026-0142",
  processId: "revenue",
  status: "scheduled",     // scheduled | waiting | live | complete
  turn: 6,                 // index into the scripted transcript, shared
  consent: false,          // the client's transcription acknowledgement
  mic: "ready",            // mocked: ready | muted
  elapsed: "00:11:24",     // mocked clock
  clientContactId: "CC-01",
  auditorUserId: "FU-03",
  observerUserIds: ["FU-02"],
};

/** Plain-language topic per stretch of the conversation. The client sees where
 *  the conversation has got to — never a coverage area, a methodology id or a
 *  percentage. `from` is the first transcript turn the topic covers. */
export const interviewTopics = [
  { from: 0,  label: "What you sell" },
  { from: 3,  label: "How orders arrive" },
  { from: 5,  label: "Opening a customer account" },
  { from: 8,  label: "Pricing and discounts" },
  { from: 13, label: "Invoicing" },
  { from: 15, label: "Credit management" },
  { from: 19, label: "Delivery and despatch" },
  { from: 23, label: "Service contracts" },
  { from: 26, label: "Credit notes and rebates" },
  { from: 30, label: "Cash receipt" },
  { from: 32, label: "Cut-off and journals" },
  { from: 36, label: "Targets and access" },
];

/** Who is in the room. Firm users and client contacts stay separate here too. */
export const interviewParticipants = {
  firm: ["FU-03", "FU-02"],
  client: ["CC-01"],
};
