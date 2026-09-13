# Client Experience v1

*The other half of the product.*

> The auditor sees the complexity.
> The client sees the next thing they need to do.

---

## 1. Purpose

Everything built before this answered one question: what does the **auditor** do? This layer answers
the other one: what does the **client** experience when an auditor asks them to explain a process?

The auditor product is complicated because auditing is — coverage, methodology, evidence, controls,
findings, contradictions, walkthroughs, testing, sign-off. The client should see almost none of
that. The portal answers four questions and stops:

1. What do you need from me?
2. Why are you asking?
3. What should I do next?
4. Am I done?

If a Financial Controller needs training to use it, it is wrong.

---

## 2. Two surfaces, one workflow

| | Auditor | Client |
|---|---|---|
| Entry | `#/` | `#/portal` |
| Frame | header, breadcrumb, process journey | one header row, no journey, no breadcrumb |
| Density | high, seven width modes | low, one width, far more air |
| Body type | 15.5px | 16.5–18px |
| Objects | steps, claims, controls, findings, gates | tasks |
| Shares | identity, palette, type, buttons, elevation | — |
| Does not share | journey, attention queue, decision workspace, map, RCM, methodology, reviewer, completion | — |

The two surfaces read the **same state**. There is one questionnaire, one interview and one set of
answers; what differs is how much of it each person is shown.

---

## 3. Routes

| Route | Screen |
|---|---|
| `#/portal` | Task inbox |
| `#/portal/questionnaire` | The client questionnaire, in portal chrome |
| `#/portal/interview` | Interview task — when, how long, with whom, what about |
| `#/portal/interview/waiting` | Waiting room and the transcription acknowledgement |
| `#/portal/interview/live` | The conversation, from the participant's side |
| `#/portal/interview/done` | Thank-you |
| `#/portal/follow-up` | One follow-up question |
| `#/portal/document` | One document request |

Same hash router, no framework, no build step.

---

## 4. The task model

```
ClientTask {
  id, engagementId, processId, contactId,
  type,        questionnaire | live_interview | follow_up | document_request
  title, why, cta, href,
  due | when | done,
  afterInterview?   created by the interview rather than seeded
}
```

Not a workflow engine. State is **derived** from the work that already knows the answer — a
questionnaire task's state comes from the questionnaire's own progress, an interview task's from
`S.interview.status` — so there is nothing to keep in sync.

Plain-language states only: *Not started · In progress · Scheduled · Ready to join · With your
auditor · Completed*. No open item, no coverage gap, no contradiction, no control decision.

**Assignment is per contact.** The Revenue questionnaire is Bas Kuipers's; the process interview is
Ruud Timmermans's. The portal shows one person their own tasks and nobody else's, and only for the
active engagement — the same isolation principle as the auditor setup layer.

---

## 5. The questionnaire

Unchanged in behaviour: one question at a time, progress, answer in your own words, *Send* /
*I don't know* / *Rather have a call*, previously answered items, no methodology language. It now
renders inside the portal chrome instead of its own bar, its progress drives the portal task, and
the prototype's "auditor view" switch moved out of the client's header into the marked dev bar.

There is **one** questionnaire. Answering in the portal produces the same evidence record the
auditor's Process Interview screen has always consumed.

---

## 6. The live interview, from both sides

`S.interview` is a single object: `{ status, turn, consent, mic, elapsed }`. The auditor cockpit and
the client participant view both read it, so advancing a turn on either side advances it on the
other, and ending it on either side ends it on both.

What each side sees of the same turn:

| Auditor cockpit | Client participant view |
|---|---|
| the transcript | the transcript |
| coverage filling in live, per sub-process | — |
| suggested next questions, with the methodology rule behind them | — |
| contradiction flags against the questionnaire | — |
| evidence requests worth making | — |
| — | the subject, in plain words ("Now talking about — Credit management") |
| Play / Next turn / End | Microphone · Continue · Leave |

The client never sees the platform thinking. No "AI is analysing", no confidence, no detected
contradiction. The intelligence belongs on the auditor's side of the table.

**Consent.** One sentence, one checkbox, and *Join* stays disabled until it is ticked. It does not
overstate what exists.

---

## 7. The privacy boundary

The client-secrecy test (`tests/client-tests.mjs` §42) reads every client-facing screen and fails on
any of: *coverage · assertion · methodology · significant deficiency · risk signal · contradiction ·
key control · walkthrough · ISA · control, risk, gap or coverage ids · confidence · review point ·
reviewer · sign-off · completion gate · working paper · evidence · provenance*.

Trust copy is one sentence and claims nothing that is not built: answers go to the audit team
working on this engagement, and this is a prototype where nothing is sent or stored.

---

## 8. What is mocked

- **No authentication.** `portalAs` is a prototype view switch shown in a bar labelled *Prototype
  view*. There is no login, no magic link, no password and no session.
- **No call infrastructure.** No WebRTC, no microphone, no camera, no screen share, no recording and
  no transcription. "Microphone ready" and the clock are UX states; the conversation is the scripted
  transcript from `data-sources.js`.
- **No file storage.** The document request accepts nothing, reads nothing and stores nothing; the
  button says so.
- **No email, notifications or calendar.** Nothing is sent when a task is assigned.
- **Session state only.** A reload restores the seed.

---

## 9. Deliberately deferred

Real authentication and magic-link access · a client permissions engine · email and push ·
WebRTC, microphone capture, video and live transcription · file storage and document management ·
chat and messaging · calendar, Teams and Zoom integration · e-signatures · a full collaboration
suite. These are infrastructure, and none of them changes the answer to the question this layer
exists to ask.

---

## 10. Demo

A separate three-minute client track (`/loop`-free, in the palette as **Client experience demo**, or
from the note on Work). Eleven beats: the auditor assigns the questionnaire → the portal as Bas →
one question answered → back to the inbox → the interview task as Ruud → the waiting room → the live
conversation → the same interview in the auditor cockpit → the thank-you → the follow-up the
interview created for Bas → the auditor's view of where everything has got to.

It is kept apart from the auditor tour because it is a different product for a different person.
