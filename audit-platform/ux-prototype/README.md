# Audit AI — Interim Platform UX Prototype

A high-fidelity, clickable prototype of the future Audit AI interim platform, built so that
auditors and design partners can experience the product before any production frontend exists.

**This is not the Audit Intelligence Engine.** The engine lives in `../audit-engine/` and is
untouched by this track. This directory is removable without affecting it.

---

## Run it

```
open index.html                       # or double-click it
```

No build, no install, no server, no network. If your browser blocks ES modules on `file://`,
serve the directory instead:

```
python3 -m http.server 8000     # then open http://localhost:8000/
```

Everything runs in the browser against mock data. No model is called, no request leaves the
page, no data is stored.

---

## What is in here

| File | What it is |
|---|---|
| `UX-PLAN.md` | The design decisions: principles, IA, screen map, review-workspace and provenance concepts, what is excluded. **Read this first.** |
| `DEMO-SCRIPT.md` | The nine-beat design-partner path, with presenter notes and the questions you will get |
| `UX-FINDINGS.md` | Twelve product and data-model gaps found while building, written for the engine track. No engine file was changed |
| `index.html` · `app.css` | Shell and the design system (tokens, primitives, components) |
| `js/data-sources.js` | The evidence base: walkthrough transcript, client questionnaire, three documents, auditor notes |
| `js/data-model.js` | Coverage (45 items), narrative (14 sections), 11 risks, 14 controls, 5 gaps, 10 open items |
| `js/state.js` | Prototype state, derivations and actions. Every headline number is computed here |
| `js/views/` | One module per screen group |

## The journey

```
Home → Client → Engagement → Revenue → Walkthrough → Coverage → Generate
     → Review narrative → Inspect sources → Risks → Controls → Matrix
     → Resolve open items → Sign-off → Export
```

Plus, off the spine: the **client questionnaire** (a separate client-facing surface) and the
**live walkthrough cockpit**, which is explicitly labelled as a future-state concept.

**Start with the guided demo** — *Design partner demo* in the left rail. It sets each screen up
and puts the line to say at the bottom. `→` and `←` move between beats, `Esc` exits.

## Things worth clicking

- **Coverage → expand R5 Invoicing.** Fact-level status. `override_report_reviewer` is the fact
  nobody could answer, and it is why a mandatory item is only partially covered.
- **Generate → run the pipeline.** Nine stages; watch stage 8, which fails three statements.
- **Documentation → section 8, then a source chip.** Hover for the quote, click to pin it.
- **Documentation → section 10.** The invented EUR 5,000 credit-note threshold. The section
  cannot be approved. Click *Resolve* to see why the model produced it.
- **Documentation → section 6.** Two sources disagree about credit-limit authority. Resolving it
  unblocks a control and a risk elsewhere.
- **Controls → C-10.** The six key-control criteria, two of them `unknown`, so the platform
  refuses to propose either way.
- **Open items.** Note which questions came from a deterministic pack rule and which the model
  proposed.

Keyboard in the review workspace: `J`/`K` move between sections, `A` approves, `E` edits,
`U` toggles the unresolved filter, `Esc` closes a drawer.

**Reset demo** (top right) returns everything to the start.

---

## The mock engagement

Vandersteen Industrial Systems B.V. — a fictional Dutch manufacturer of conveyor systems,
revenue EUR 48.6m across two streams, EU-IFRS, audited by the fictional firm Kuyper & Bergman.
No real entity, person or engagement is depicted.

It is built to exercise the states the product has to handle: an ERP-driven order-to-cash flow,
warehousing outsourced mid-year to a third party, price overrides nobody reviews, reciprocal
approval of manual journals, an undocumented cut-off review, a consignment arrangement disclosed
only in a questionnaire, one contradictory answer across two sources, and one AI claim that no
source supports.

Coverage items, risk ids (`RSK-REV-*`) and control ids (`CTL-REV-*`) are the real ids from
methodology pack `revenue v0.1.0` in `../audit-engine/packages/methodology/`.

---

## What this prototype deliberately does not do

No authentication, database, tenancy or storage. No Anthropic API or any real inference. No
WebRTC, speech recognition or audio. No document ingestion, OCR or export generation. No
integrations. No process other than Revenue, no control testing, no sampling. Prior-year
comparison, the test plan and an editable RCM grid are out of scope by design — see
`UX-PLAN.md §12` for the reasoning on each.

Interactions are real: approving, editing, rejecting, resolving, filtering and marking not
applicable genuinely mutate state and are reflected on every screen. The *intelligence* is
scripted — the point is the experience of the pipeline, not a live model in a demo.

---

## If this becomes production

The prototype is zero-build vanilla ES modules on purpose (`UX-PLAN.md §11`): it has to open on
a design partner's laptop in a meeting room with no toolchain and no internet. It is still
shaped to port: `app.css` is a token file, views are pure `state → HTML` functions that map onto
components, and the mock data follows the real Zod schemas in `../audit-engine/packages/domain`.

Before building the production frontend, read `UX-FINDINGS.md`. Four of the twelve findings
(F-01, F-02, F-05, F-10) add fields to records rather than changing behaviour, and are far
cheaper to decide before the first migration than after it.
