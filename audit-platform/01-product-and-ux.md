# 1. Product & User Experience

## 1.1 The problem, stated precisely

The interim phase of a statutory audit is where the team builds its understanding of the
entity's processes and internal control (ISA 315R), identifies risks of material
misstatement at assertion level, decides which controls to rely on, and plans control
testing. Today that work looks like this:

1. A senior schedules a walkthrough call with a process owner.
2. They talk for 45–90 minutes, taking notes in Word or on paper.
3. Afterwards they spend 2–4 hours writing a narrative, updating last year's document,
   re-deriving risks and controls, and updating the RCM in Excel.
4. Half the follow-up questions surface *while writing up*, days later, requiring a second
   contact with the client and often getting dropped under time pressure.
5. The manager reviews, sends it back, and the loop repeats.
6. Prior-year comparison is a manual read-through; process changes are found by accident.

The cost per process is 4–8 hours of chargeable senior time. Quality is heterogeneous
across teams, and the biggest quality risk — an incomplete understanding of the flow of
transactions — is invisible until file review or an oversight inspection.

**What the platform changes.** The write-up becomes a review task instead of an authoring
task, follow-ups happen *during* the meeting instead of a week later, and coverage of the
process is measured rather than assumed.

## 1.2 Personas

| Persona | Goal | What they must never experience |
|---|---|---|
| **Audit senior / in-charge** (primary user) | Get a defensible process understanding and RCM in one sitting | Having to re-type what the AI already knows; an AI claim they cannot trace to a source |
| **Manager / reviewer** | Review efficiently, see what changed vs. last year, evidence the review | Reviewing text with no provenance; losing their review notes on regeneration |
| **Engagement partner / EQR** | Confidence the file is defensible; see status across processes | Discovering an unapproved AI conclusion in the signed file |
| **Client process owner / controller** | Answer once, clearly, without an hour-long call if possible | Being asked things the auditor already has; uploading documents into an unclear place |
| **Client finance director** | Control what leaves the company, see what's outstanding | Not knowing who saw what, or where the recording lives |
| **Firm methodology / quality department** | The tool follows *our* methodology and standards | A black box; a tool that draws conclusions the firm can't reconstruct |
| **Firm IT / security officer** | Approve the vendor | Data leaving the EU; multi-tenant DB with no hard isolation; no ISAE/ISO assurance path |

The first four are v0.1 users. The last three are v0.1 *buyers and blockers* — the plan
treats them as first-class (see `04`).

## 1.3 The four-step promise

The whole product is one loop, and every design decision defends its simplicity:

```
      1. SELECT              2. WALKTHROUGH            3. REVIEW              4. APPROVE
   ┌──────────────┐      ┌────────────────────┐   ┌────────────────┐   ┌──────────────────┐
   │ Engagement   │      │ AI-led   │ Auditor │   │ Narrative      │   │ Sign off         │
   │ → Revenue    │─────▶│ AI-listen│ -led    │──▶│ Risks/Controls │──▶│ Export to Word/  │
   │ + knowledge  │      │ Client questionnaire│   │ RCM / Tests    │   │ Excel / file     │
   └──────────────┘      └────────────────────┘   └────────────────┘   └──────────────────┘
                                    │                      ▲
                                    └──── live follow-ups ─┘
                                     evidence requests, risks
```

Anything that does not serve this loop is a settings page, not a screen.

## 1.4 Screen inventory (v0.1)

### S1 — Engagement dashboard (landing)

Per engagement (client × financial year), one row per process with:

- Status pill: `Not started · Scheduled · In progress · Draft ready · In review · Approved · Locked`
- Coverage % (from the coverage model), number of open follow-up questions, open evidence requests
- Counts: risks identified / controls / key controls / gaps / tests planned
- Prior-year delta badge: *"7 changes vs. PY"*
- Owner avatar and last activity

Top of the page: engagement header (client, FY, team, materiality if entered), and three
big actions: **Start walkthrough**, **Invite client**, **Export file**.

For v0.1 only *Revenue* is populated; the other five processes are shown greyed with
"coming soon" so the shape of the product is visible to the pilot firms.

### S2 — Walkthrough setup

One short screen, three fields, no wizard:

1. **Process**: Revenue (locked in v0.1) + optional scoping notes (e.g. "Only the Dutch entity, product sales; services excluded").
2. **Participants**: client contacts (name, role, email) + auditors. Client contacts get portal access scoped to this engagement.
3. **Mode**: `AI conducts the interview` · `I conduct it, AI listens` · `Send as questionnaire`.

Plus a **Knowledge panel** (persistent, reusable across walkthroughs in the engagement):
drag in prior-year narrative and RCM, process descriptions, flowcharts, system
documentation, org charts, sample invoices/orders, contract templates, SOC 1/ISAE 3402
reports of service organisations. Files show an ingest state (`Uploading → Scanning →
Indexed`) and a one-line AI summary so the auditor can confirm the right thing was
understood. Prior-year import is a separate, labelled action because it feeds the
comparison stage.

Before the meeting the system pre-generates a **tailored interview plan** — the standard
Revenue template narrowed by what it already knows from the knowledge base, with items it
already believes it knows marked *"confirm only"*. This is the moment the product first
feels tailored, and it happens before anyone speaks.

### S3 — Live walkthrough cockpit (the flagship screen)

Three panes, fixed layout, no modal dialogs:

**Left — Conversation.** Live transcript with speaker labels and timestamps. In AI-led
mode, the AI's current question is pinned at the top in large type, with `Ask next`,
`Rephrase`, `Skip`, `Park` controls. In auditor-led mode the pane is read-only transcript.
A recording indicator and consent state are always visible.

**Middle — Coverage.** The process template as a live checklist, grouped by sub-process
(customer & contract, order entry, credit, delivery/performance, invoicing, revenue
recognition, credit notes, cash receipt, cut-off, IT & interfaces, manual journals).
Each coverage item is `open · partially covered · covered · not applicable`, with the
covering quote on hover. This pane is the auditor's real-time answer to "have we asked
enough?" — the thing that today only becomes clear during write-up.

**Right — Live insights.** Three stacked, collapsible lists that fill as the conversation
goes:
- **Ask this next** — suggested follow-ups, ranked, each with a one-line reason ("no
  control mentioned over pricing changes in the order entry step"). One click to have the
  AI ask it (AI-led) or to copy it as prompt text (auditor-led).
- **Spotted** — provisional risks and controls with the quote that triggered them.
- **Request** — evidence requests (e.g. "screenshot of the credit-limit configuration",
  "list of manual revenue journals for Q1"), each with **Send to client portal** available
  *during* the meeting.

Everything in this pane is provisional and visibly labelled as such; nothing here is
documentation yet.

**Interaction rules**
- Latency budget: transcript partials < 1s, insight refresh every ~15s or at each speaker
  turn boundary. Nothing in the right pane blocks the conversation.
- Network drop must not lose the meeting: audio is buffered locally and uploaded on
  reconnect; the transcript rebuilds from the recording.
- Ending the walkthrough is one button; generation runs in the background and the user is
  told "ready in ~10 minutes" with a notification, not a spinner.

### S4 — AI questionnaire (client-facing, in the portal)

Same engine, asynchronous: the client answers one question at a time, in their own
language, with the AI asking intelligent follow-ups on the response before moving on, and
requesting a document where one is implied ("you mentioned a credit limit report — can you
upload an example?"). Progress bar by sub-process, save-and-resume, and a "let's just have
a call instead" escape hatch that converts the session into a scheduled walkthrough with
the answers already loaded.

### S5 — Review workspace (where the auditor spends most of their time)

A two-column workspace, tabbed by artefact (Narrative · Flow · Risks & assertions ·
Controls & gaps · Key controls · RCM · Test plan · Open items).

- **Left**: the generated content, block by block. Each block has status
  `Draft · Edited · Approved · Rejected` and controls: ✏️ edit inline, ✓ approve,
  ✗ reject with reason, 💬 comment, 🔄 regenerate *this block only*.
- **Right**: **Sources** — the evidence behind the selected block. Transcript quotes with
  the timestamp (click to play the audio at that moment), and document chunks with the
  page and file name. A block whose sources fail validation is marked
  **Needs source** in amber and cannot be approved until the auditor edits it or attaches
  evidence.
- Bulk actions: *Approve all in this tab that are unedited and grounded* — with a
  confirmation that names the count, so it stays a deliberate act.
- A right-hand rail shows: coverage %, open follow-ups, unresolved evidence requests, and
  "changes vs prior year" for the artefact in view.

**Review levels.** Preparer (senior) → reviewer (manager) → optional EQR. Each level is a
separate sign-off recorded per artefact with who/when, satisfying the ISA 230 requirement
to document who performed and who reviewed the work.

### S6 — RCM editor

A spreadsheet-grade grid (virtualised table, keyboard navigation, paste from Excel)
because that is the artefact auditors already know. Columns follow `02 §2.6`. AI-suggested
rows are visually distinguished until accepted. Filters by sub-process, assertion, key/non-key,
and gap. Add-row and split-row are first-class — the AI will miss things and the auditor
must never feel boxed in.

### S7 — Test plan

Per key control: suggested test approach (inquiry / observation / inspection /
reperformance), the population and its source, what to request from the client, sample
size derived from the firm's methodology parameters (frequency × risk), and the attributes
to inspect. Sample sizes are always shown as *"per firm methodology: 25 (monthly control,
higher risk)"* so the number is traceable to the firm's own table, not to the model.

### S8 — Client portal

Separate, minimal, branded surface for client users:
- Open requests (questionnaires, evidence requests) with due dates and one-click upload.
- What they've already provided, and who at the firm requested it.
- No access to auditor working papers, risks, controls, or any AI conclusion.
- Their own audit trail of uploads and messages.

### S9 — Prior-year comparison

A diff view: last year's approved narrative/risks/controls beside this year's draft, with
changes classified as `New · Removed · Changed · Unchanged`, each with the evidence for
the change ("the credit check moved from manual approval by the CFO to an automated block
in the new ERP — see transcript 00:23:14"). A one-click **"Confirm as process change"**
writes it into the file as an explicit conclusion — which is exactly the ISA 315R
requirement to evaluate whether the prior understanding remains valid.

### S10 — Export centre

Choose artefacts → choose template (firm Word template with styles, or plain) → generate.
Produces:
- `Process narrative + flow` (DOCX, firm styles, headers/footers, review sign-off block)
- `Risk & Control Matrix` (XLSX, one row per risk-control pair, filters preset)
- `Test plan` (XLSX or DOCX)
- `Engagement export` (canonical JSON + all evidence references) for downstream systems

Each export embeds a documentation footer: source walkthrough(s), date, preparer,
reviewer, and a statement that AI assistance was used with the model version.

## 1.5 Trust-by-design UX principles

These are testable requirements, not slogans.

1. **Provenance is one click away, always.** Every generated sentence, risk, control and
   RCM cell has an evidence trail reachable in one interaction.
2. **Provisional and documented are visually different.** Live-interview insights use a
   distinct, lighter treatment; nothing becomes documentation without passing through review.
3. **Nothing regenerates silently.** Approved content is immutable; regeneration creates
   a new version with a visible diff and requires re-approval.
4. **Absence is shown, not hidden.** "We did not obtain information about X" is a
   first-class output. An incomplete walkthrough must *look* incomplete.
5. **No confidence theatre.** No percentage confidence scores on individual claims. Instead:
   grounded / needs source, and coverage completeness — both objectively checkable.
6. **The auditor can always override.** Every field is editable; edits are never
   overwritten by the model; the model may propose, the human disposes.
7. **Language follows the user.** Interview in Dutch, document in English (or vice versa)
   is a per-artefact setting — normal in Dutch practice and a hard requirement for the
   pilot firms.
8. **Speed is a feature of the meeting, not the report.** Sub-second transcript, ~15s
   insight refresh, and generation that runs after the call — never a user waiting on a
   model mid-conversation.

## 1.6 What "done" feels like for the pilot

A senior who has done revenue walkthroughs for three years should be able to run one on
the platform with no training beyond a 10-minute demo, finish the documentation the same
day, and be able to answer, for any sentence in the file, the question *"where does this
come from?"* in under five seconds.
