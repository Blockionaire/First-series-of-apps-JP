# UX Plan — Audit AI Interim Platform

**Track:** UX / Product prototype. Isolated from the Phase 0 Audit Intelligence Engine.
**Branch:** `claude/ux-prototype-604ke3`
**Source of truth:** `audit-platform/00`–`09`, and the Revenue pack at
`audit-platform/audit-engine/packages/methodology/packs/revenue/v0.1.0/`.

The Phase 0 engine answers *"does the audit intelligence work?"*. This prototype answers a
different question: *"would auditors want to work this way?"* It is a demonstration
surface, not a frontend foundation. Nothing here is production code and nothing here
changes the engine.

---

## 1. Product UX principles

Nine rules. Each is testable against a screen, and each traces to `01 §1.5` or `02 §2.11`.

1. **Provenance is one interaction away, always.** Every generated claim carries a source
   chip. One click opens the exact quote, timestamped, in the panel already on screen — no
   navigation, no modal.
2. **The absence of information is a first-class output.** "We did not establish who
   reviews the price-override report" is rendered as content, not as a blank. An
   incomplete walkthrough must *look* incomplete at a glance.
3. **Draft and documentation are visually different.** AI output is grey-toned and
   labelled *Draft*. Approved content changes typographic weight and colour. A partner
   glancing at the screen can tell which is which from two metres away.
4. **An ungrounded claim cannot be approved.** *Needs source* is a hard gate in the UI, not
   a warning. The auditor resolves it by attaching evidence, editing the sentence, or
   rejecting it. This is the single most important interaction in the product.
5. **No confidence theatre.** No "AI confidence: 93%". States are objectively checkable:
   `grounded` · `needs source` · `contradictory` · `not obtained` · `edited` · `approved` ·
   `rejected`.
6. **The auditor decides; the AI proposes.** Every judgement field (`is_key_control`,
   risk rating, significant risk, N/A, design effective) shows the AI's proposal and the
   auditor's decision as two separate, visibly distinct values.
7. **Review must cost fewer actions than writing.** Approval granularity is the section,
   not the sentence. Bulk approval exists but names its count. The screen always shows how
   much work is left in units of *decisions*, not percentages.
8. **Methodology is visible, not magic.** Coverage is measured against the named pack and
   version. Every follow-up question shows whether it came from a deterministic trigger or
   from the model. The auditor can see the rules.
9. **Calm over clever.** No gradients, no animation for its own sake, no chat window as the
   primary surface. The product should be boring in the way good financial software is
   boring.

---

## 2. Primary user

**Audit senior / assistant manager conducting and documenting a Revenue walkthrough**, in a
mid-sized firm, on a laptop, under time pressure, in September of the interim phase.

They are competent, sceptical, and have written this document by hand five times before.
They will not read a manual. They will judge the product in ninety seconds on one question:
*can I trust the output enough that reviewing it beats writing it?*

Secondary users appear in the prototype only where the primary journey needs them:
the **manager/reviewer** (sign-off levels), the **client controller** (questionnaire), and
the **partner** (read-only readiness view). Methodology teams and firm administrators are
acknowledged in Settings and nowhere else — they are buyers, not daily users, and designing
for them now would bloat the product.

---

## 3. Primary user journey

The whole prototype is one spine. Everything else is a detour off it.

```
Home ─▶ Client ─▶ Engagement ─▶ Interim ─▶ Revenue workspace
                                              │
      ┌───────────────────────────────────────┴────────────────────────┐
      │                                                                │
   PREPARE ──▶ GATHER ──▶ COVERAGE ──▶ GENERATE ──▶ REVIEW ──▶ RESOLVE ──▶ APPROVE ──▶ EXPORT
   scope       one of        what we      staged     narrative   open      sign-off    Word
   knowledge   3 modes       still        pipeline   risks       items                 Excel
   plan        (+ future     don't know   with       controls    evidence              JSON
               cockpit)                   validation  RCM        requests
```

Four verbs the auditor actually uses: **prepare · gather · review · approve**. The words
"generate" and "AI" appear in the UI only where they describe a specific mechanical step.

---

## 4. Information architecture

### The decision

Enterprise SaaS convention would give us `Home · Clients · Engagements · Documents ·
Reports · Settings`. That is wrong here, for two reasons: an engagement is *always* reached
through a client, so a global Engagements list duplicates the Clients list; and audit
documentation is an artefact *of* an engagement, never a global library — a "Documents"
tab would invite the auditor to leave the workspace where their context lives.

So the global navigation is **three items**, and the primary journey never uses it after
the first click:

```
GLOBAL RAIL          Work        ← the dashboard; what needs attention today
                     Clients     ← portfolio; the only route to an engagement
                     Settings    ← firm methodology pack, templates, team

ENGAGEMENT BAR       Planning · Interim · Final · Completion    (only Interim is live)

PROCESS WORKSPACE    Revenue ▸ Overview · Walkthrough · Coverage · Documentation ·
                               Risks · Controls · RCM · Open items · Sign-off · Export
```

**The load-bearing idea: one process workspace with tabs.** Coverage, documentation, risks,
controls and open items are not separate destinations — they are views of the same object,
and the auditor moves between them constantly. Tabs keep the engagement header, the status
strip and the source panel persistent, so context never resets. Nine of the seventeen
screens in this prototype are tabs of a single workspace, which is why the journey requires
so little navigation.

Everything outside the spine is reachable but never on it: the client questionnaire is a
separate branded surface, the future cockpit is a labelled experiment, Settings is a
settings page.

---

## 5. Screen map

| # | Screen | Route | Phase | Notes |
|---|---|---|---|---|
| A | Work / auditor dashboard | `#/` | 1 | Actionable work only: engagements needing something *from you* |
| B | Client overview | `#/client` | 1 | Client, engagements, period, team, interim status |
| C | Engagement overview | `#/engagement` | 1 | Four audit phases; six processes, one live |
| D | Revenue process overview | `#/revenue` | 1 | The control screen: coverage, facts, gaps, review progress |
| E | Walkthrough preparation | `#/prepare` | 1 | Scope, knowledge base, tailored interview plan, mode choice |
| F | Client questionnaire | `#/questionnaire` | 1 | Client-facing; structured, one question at a time |
| G | Auditor-assisted walkthrough | `#/interview` | 1 | Auditor conducts; AI observes and suggests, never interrupts |
| H | **Live walkthrough cockpit** | `#/cockpit` | **Future** | Three panes. Explicitly labelled future state (`00` Product 3) |
| I | Coverage & missing information | `#/coverage` | 1 | 12 sub-processes, 45 items, fact-level status |
| J | Generation | `#/generate` | 1 | Nine visible pipeline stages, including a validation stage that *fails* |
| K | Review workspace — narrative | `#/review` | 1 | **The screen. Split-pane, section-level approval, live source panel** |
| L | Risks | `#/risks` | 1 | AI proposal vs auditor decision, side by side |
| M | Controls | `#/controls` | 1 | Including the six key-control criteria from `02 §2.7` |
| N | Risk & control matrix | `#/rcm` | 1 | Assembled, not generated; dense grid |
| O | Open items & follow-ups | `#/open-items` | 1 | Questions, contradictions, evidence requests — one worklist |
| P | Approval / sign-off | `#/signoff` | 1 | Readiness gates; preparer / reviewer; AI never signs |
| Q | Export | `#/export` | 1 | Word, Excel RCM, canonical JSON; blocked while gates are red |
| — | Demo mode | `#/demo` | — | A nine-step guided path over the screens above |

Deliberately **not** built: prior-year comparison (`01 S9`), test plan (`01 S7`), the RCM
*editor* as opposed to viewer, the client portal beyond the questionnaire, and any
settings screen with real behaviour.

---

## 6. Key interaction patterns

Eight patterns carry the whole prototype. They are defined once and reused everywhere.

1. **Status token.** A 6px square plus a word. Seven states, one colour each, used
   identically on every screen. Never a coloured pill with white text — that reads as
   consumer SaaS.
2. **Source chip.** A superscript bracket after a claim: `[T 12:04]`, `[Q 3]`, `[D p.4]`.
   Hover previews the quote in a popover; click pins it in the source panel and highlights
   the exact span. A claim with no source shows `[no source]` in amber.
3. **Proposal / decision pair.** Two stacked rows: *AI proposes* (grey, italic label) and
   *Auditor decision* (ink, control). Used for risk ratings, key controls, N/A, severity.
4. **Fact chip.** A must-know fact rendered as a small token coloured by status: known,
   unknown, contradictory, assumed. This is how the coverage screen becomes readable at
   45-item scale.
5. **Split pane with a persistent right panel.** Documentation left, evidence right. The
   panel never opens or closes as a modal; it changes contents. This is the difference
   between "traceability exists" and "traceability is usable".
6. **Focus filter.** A single toggle on every review surface: *Show unresolved only*. This
   is the mechanism by which a 60-block document becomes an eight-decision task.
7. **Named bulk action.** `Approve 9 grounded, unedited sections` — the count is in the
   button label, and confirmation names what is excluded and why.
8. **Drawer, not page.** Resolving an open item, viewing a source in full, or editing a
   block happens in a right-hand drawer over the current screen. The auditor never loses
   their place in a 14-section document.

---

## 7. Review workspace concept

This is where disproportionate effort goes, because it is where the auditor spends their
time and where the product is won or lost.

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Revenue ▸ Documentation     [Show unresolved only ▢]  [Approve 10 sections] │
│  14 of 14 sections need a decision · 3 need a source · 1 contradictory        │
├───────────────────┬──────────────────────────────────────┬───────────────────┤
│  SECTIONS         │  NARRATIVE                           │  SOURCES          │
│                   │                                      │                   │
│  ✓ Overview       │  ## Invoicing                        │  Transcript       │
│  ✓ Systems        │                                      │  18 Sep · 12:04   │
│  ● Roles      2   │  Invoices are generated automat-     │  ─────────────    │
│  ● Order entry    │  ically overnight from the des-      │  "Business Cen-   │
│  ▲ Pricing    1   │  patch record. [T 12:04] [D p.3]     │  tral raises it   │
│  ▲ Credit     ⚠   │                                      │  automatically    │
│  ● Delivery       │  Credit notes above EUR 5,000        │  overnight from   │
│  ▸ Invoicing      │  require approval by the finan-      │  the despatch..." │
│  ● Recognition    │  cial controller. [no source]        │                   │
│  ...              │                                      │  ▸ 2 more sources │
└───────────────────┴──────────────────────────────────────┴───────────────────┘
     navigator              content, block by block            evidence, pinned
```

### The decisions that matter

**Granularity: section, not sentence.** Fourteen sections is fourteen decisions. Sentence
approval would be roughly 90 and would convert a writing task into a clicking task — the
exact failure mode `01 §1.6` warns about. But *status* is still tracked per block, because
one ungrounded sentence must be able to block its section. A section is approvable only
when every block inside it is grounded or human-authored.

**Bulk approval, deliberately.** `Approve all grounded, unedited sections` is offered with
the count in the label and a confirmation listing what it excludes: anything needing a
source, anything contradictory, anything the auditor has already edited. Bulk approval can
never sweep up a problem — that is what makes it safe to offer.

**The unresolved filter is the real feature.** With it on, the document collapses to the
sections not yet decided — and of those, the four that are *blocked* (three carrying an
unsupported statement, one carrying a contradiction) are the only ones that need real thought. The claim "review is faster than authoring" is only true if the
auditor can find the 8% that needs them.

**Regeneration shows a diff.** Regenerating a section produces a side-by-side with changed
sentences marked, and re-approval is required. Approved content is never silently
overwritten (`01 §1.5.3`).

**Keyboard.** `J`/`K` move between sections, `A` approves, `E` edits, `S` opens sources.
A senior reviewing their fifth engagement should never touch the mouse.

**The effort meter.** The header states the remaining work in decisions: *"14 of 14 sections
need a decision"*, falling as you go. Not a percentage. The auditor should be able to estimate the time cost
of finishing before they start.

---

## 8. Provenance interaction concept

Traceability is the differentiator, so it gets a designed interaction rather than a link.

**Three levels, escalating on demand:**

| Level | Interaction | Shows | Cost |
|---|---|---|---|
| Ambient | Read the text | A source chip after each claim, and a count for multi-source claims: `[T 12:04 +2]` | 0 clicks |
| Preview | Hover the chip | Popover: the quote, the speaker, the timestamp, the source name | 0 clicks |
| Full | Click the chip | Source panel pins the source, scrolls to the quote, highlights the exact span, offers *open full transcript* | 1 click |

**The four provenance situations the prototype deliberately demonstrates:**

1. **Well grounded, single source** — invoicing generated from the despatch record.
2. **Multiple supporting sources** — a claim corroborated by the transcript, the
   questionnaire and the ISAE 3402 report; the chip shows `+2` and the panel lists all
   three, so the auditor sees corroboration rather than repetition.
3. **Missing source** — a plausible, well-written sentence the model could not ground. It
   is underlined in amber, carries `[no source]`, and **cannot be approved**. This is the
   moment the demo lands: the system stops itself.
4. **Contradictory sources** — the controller and the commercial director gave different
   answers about who can raise a credit limit. Both quotes are shown side by side, and the
   auditor must pick one, record both, or ask again. The narrative sentence stays blocked
   until they do.

**What we refuse to do:** bury provenance behind a "view sources" page, show a similarity
score, or let an ungrounded claim through with a warning banner.

---

## 9. Coverage interaction concept

Coverage answers one question — *what do we still not know?* — and it has to do so at the
scale of 12 sub-processes and 45 coverage items without becoming a spreadsheet.

**Three levels:**

- **Process level.** One horizontal bar per sub-process, segmented into covered / partial /
  open / not applicable. Segments, not a percentage bar — a 75% that is one open mandatory
  item is very different from a 75% that is three partials, and the segments show it.
- **Item level.** Expand a sub-process to see its coverage items with the question intent,
  the mandatory flag, and the state.
- **Fact level.** Expand an item to see its must-know facts as chips: `price_source ✓`,
  `who_reviews_override_report ✗`, `limit_change_approval ⚠ contradictory`. This is the
  atomic unit of "unknown" and the thing the follow-up question is generated from.

**Coverage is a worklist, not a report.** Every unknown fact carries its actions inline —
*Ask client · Record auditor answer · Mark not applicable · Request evidence · Resolve
contradiction*. Marking not applicable requires a reason, and that reason is written into
the documentation (`02 §2.4`), which the UI states explicitly at the point of the decision.

**Mandatory items are separated visually.** The ISA 240 items (`02 §2.9`) cannot be quietly
left open: they are pinned to the top of the coverage screen with a distinct marker, and
sign-off is blocked while any is open without a documented "not obtained" reason.

**The denominator is honest.** The header reads *"37 of 44 applicable items covered · 1 not
applicable"* rather than a bare percentage, and a footnote states that coverage measures the
completeness of the *understanding* against `revenue v0.1.0`, not the completeness of the
audit (`02 §2.1`).

---

## 10. Phase 1 realistic vs. future-state

The prototype must not mislead a design partner about what is near. Two visual registers:

**Phase 1 — realistic (default register).** Dashboard, client, engagement, Revenue
workspace, preparation, questionnaire, auditor-assisted walkthrough, coverage, generation,
review workspace, risks, controls, RCM, open items, sign-off, export. These use the normal
UI and imply a buildable product. They correspond to phases B–C in `00`.

**Future state (marked register).** The **Live Walkthrough Cockpit** only. It carries a
persistent header band reading *"Future state — not part of the current build"*, uses a
slightly recessed background, and its transcript is a scripted replay rather than a
simulation of real capability. `00` places it in Product 3 behind the engine result; the
prototype shows it because it is the vision, and marks it because honesty with design
partners is worth more than a demo effect.

**Mocked-but-realistic (shown as intent, clearly non-functional).** Transcript import,
Teams/Zoom/Meet connectors, evidence upload, Word/Excel export downloads, and the
audit-system integration tile. Each shows what it would do and states that it is mocked.

---

## 11. Prototype technical approach

**Zero-build static web app: HTML, CSS custom properties, and vanilla ES modules.**

The reasoning, in order of weight:

1. **It must open on a partner's laptop with no internet and no toolchain.** A demo that
   needs `npm install` will fail in a meeting room once, and that is once too many.
   `index.html` opens from the filesystem or any static host; the repo already ships static
   HTML apps and carries `.nojekyll` for GitHub Pages.
2. **`08` explicitly rejects a bundler, a CSS framework and a UI library for this stage**,
   on the rule that every dependency must justify itself. A prototype does not clear that
   bar.
3. **It still informs production.** The design system is a token file (`app.css` custom
   properties) that ports directly to Tailwind config or CSS-in-JS; views are pure
   `state → HTML string` functions that map one-to-one onto React components; data is
   separated from views and shaped to the engine's real domain types. Porting is a
   translation, not a redesign.

**Structure**

```
ux-prototype/
  index.html            shell, fonts, mount point
  app.css               design system: tokens, primitives, components
  js/app.js             hash router, application shell, keyboard map
  js/ui.js              rendering helpers and shared components
  js/state.js           mutable prototype state + actions (approve, edit, resolve…)
  js/data-sources.js    the evidence base: transcript, questionnaire, documents
  js/data-model.js      coverage, facts, narrative, risks, controls, open items
  js/demo.js            the nine-step design-partner path
  js/views/*.js         one module per screen group
```

**Fidelity rules.** Mock data is written to the shape of the real Zod schemas in
`packages/domain` — `EvidenceRef`, `ProcessFact`, `CoverageItemState`, `NarrativeBlock`,
`Risk`, `Control`, `KeyControlProposal` — so that a finding in this prototype is a finding
about the real contracts. Library references (`RSK-REV-021`, `CTL-REV-019`) are the actual
ids from the shipped pack. Coverage items are the actual 45 items of `revenue v0.1.0`.

**Interactions are real; intelligence is scripted.** Approving, editing, rejecting,
filtering, resolving and marking not applicable genuinely mutate prototype state and are
reflected everywhere. Generation, follow-up questions and grounding failures are scripted
to a fixed narrative — the point is the *experience* of the pipeline, and a real model here
would only add non-determinism to a demo.

**State is in memory, with an explicit reset.** No persistence, so every demo starts clean.
A `Reset demo` action is always available in the header.

---

## 12. What is explicitly excluded

Not built, by instruction and by judgement:

- Production authentication, database, tenancy, RLS, storage, cloud infrastructure
- Anthropic API integration or any real inference
- WebRTC, speech recognition, diarisation, real audio
- Real evidence ingestion, OCR, document parsing
- SSO, SCIM, audit logs, security infrastructure
- Caseware / CCH / ERP integrations
- Any process other than Revenue; control testing; sampling
- A native mobile application

Not built, by design judgement (each is a real requirement, later):

- **Prior-year comparison** (`01 S9`) — high product value, but it needs a second year of
  data to demonstrate honestly, and a faked diff would teach us nothing about the UX.
- **Test plan** (`01 S7`) — depends on a firm's sample-size parameter table; without it the
  screen would be decorative.
- **RCM editing** — the RCM is shown as an assembled view. A spreadsheet-grade editable
  grid is a week of work that tests nothing about the core hypothesis.
- **A settings area with behaviour** — one static page showing the pinned pack version, and
  no more.
- **Multi-role switching** — the prototype is the senior's view. The reviewer appears only
  as a sign-off level, the partner only as a readiness state.

---

## Deliverables

1. `UX-PLAN.md` — this document.
2. The clickable prototype — `index.html` and the modules above.
3. `DEMO-SCRIPT.md` — the nine-beat design-partner path, also driven in-app from `#/demo`.
4. `UX-FINDINGS.md` — product and data-model gaps discovered while designing, written for
   the engine track to review. No engine file is modified from this session.
