# Audit AI — Interim Platform UX Prototype

A high-fidelity, clickable prototype of the future Audit AI interim platform, built so that
auditors and design partners can experience the product before any production frontend exists.

**Third iteration.** V1 proved the product logic and looked like enterprise audit software. V2
fixed how it feels — calm, exception-driven, keyboard-first. V3 fixes *what it is*: not an AI
documentation generator, but the workspace in which an auditor performs the **interim audit of a
business process**, end to end. `V3-DESIGN-DIRECTION.md` is that reframing;
`NEXT-GEN-UX-DIRECTION.md` is the V2 critique whose interaction philosophy still holds. V1 is at
git tag `ux-v1`.

**This is not the Audit Intelligence Engine.** The engine lives in `../audit-engine/` and is
untouched by this track. This directory is removable without affecting it.

---

## Run it

### The easy way — one file, no server

**`audit-ai-prototype.html`** is the whole prototype in a single self-contained file. Download it
and double-click. It works in Chrome, Edge, Firefox and Safari, offline, with nothing installed.
Everything is inlined — CSS, all fourteen modules, all mock data — and it makes no network
requests at all. Email it to a design partner and it will work on their machine.

### The developer way — the modular source

`index.html` plus `js/` is the real source, and it is what you edit. It is built from ES modules,
so it **needs a local static server** — double-clicking `index.html` gives a blank page, because
every browser blocks module scripts over `file://` under CORS.

```
python3 -m http.server 8000        # then open http://localhost:8000/
```

Any static server works: `npx serve`, `php -S localhost:8000`, VS Code's Live Server.

### Rebuilding the single file

After changing anything under `js/` or `app.css`:

```
python3 build-standalone.py        # regenerates audit-ai-prototype.html
```

No dependencies — standard-library Python only. The script wraps each module in the same
registry an ES-module loader would provide, so module scope is preserved and the bundle behaves
identically to the source. It refuses to build on a dynamic `import()`, an unsupported export
form or an import cycle rather than emitting something subtly broken.

There is no build step for development, no install and no dependencies. Everything runs in the
browser against mock data: no model is called, no request leaves the page, nothing is stored.

---

## What is in here

| File | What it is |
|---|---|
| `V3-DESIGN-DIRECTION.md` | The product scope: the full process-level interim audit. **Read this first.** |
| `NEXT-GEN-UX-DIRECTION.md` | The V2 critique — the interaction philosophy, still in force |
| `UX-PLAN.md` | V1's plan. Still the reference for provenance rules and what is excluded |
| `DEMO-SCRIPT.md` | The nine-beat design-partner path, with presenter notes and the questions you will get |
| `UX-FINDINGS.md` | Twelve product and data-model gaps found while building, written for the engine track. No engine file was changed |
| **`audit-ai-prototype.html`** | **The whole prototype in one file. Download, double-click, done. Generated — do not edit** |
| `build-standalone.py` | Regenerates the file above from the source |
| `index.html` · `app.css` | Shell and the design system (tokens, primitives, components) |
| `js/data-sources.js` | The evidence base: walkthrough transcript, client questionnaire, three documents, auditor notes |
| `js/data-model.js` | Coverage (45 items), narrative (14 sections), 11 risks, 14 controls, 5 gaps, 10 open items |
| `js/data-process.js` | The process map (8 steps), the line walkthrough (7 traced steps), the control-testing concept |
| `js/state.js` | State, derivations, the exception model and the undo stack. Every headline number is computed here |
| `js/palette.js` | ⌘K — the navigation |
| `js/views/` | One module per stage |

## The workflow

Two layers. The **engagement** — client, year, phases, six processes — and the **process
workspace**, where Revenue is carried through seven steps:

```
PREPARE ─▶ WALKTHROUGH ─▶ UNDERSTANDING ─▶ CONTROLS & ─▶ LINE ─▶ CONTROL ─▶ COMPLETE
                                           FINDINGS      WALKTHROUGH  TESTING
```

The journey bar is ordered and stateful, not a tab bar: each step shows what it still owes, and a
step that has not started says why. Inside every step the rhythm is the same four beats —
understand, review, resolve, complete — which is why the product only teaches them once.

Everything else — the matrix, the working paper, the questionnaire, the future cockpit, any
process step, section, control, finding, coverage area or source — is two keystrokes away on **⌘K**.

Risk analysis is deliberately **outside** this product. Interim hands the process understanding,
the matrix and the findings forward to it.

**Start with the guided demo** — the link on the Work screen, or `⌘K → Guided demo`. It sets each
screen up and puts the line to say at the bottom. `→` and `←` move between beats, `Esc` exits.

## Things worth doing

- **Revenue home.** The Process Understanding Map plus the seven-step journey. Click any step to
  see its controls, findings and sources.
- **Walkthrough.** Three gaps in plain English; *Show methodology* reveals the 45 coverage items,
  fact keys, triggers and ISA references underneath.
- **Understanding → Start.** Nine pipeline stages. The validation stage catches three unsupported
  statements and the result waits for you to read it.
- **Then press Enter four times.** The contradiction first, with both sources side by side, then
  the three unsupported claims, each with the correction pre-written.
- **Read the working paper and click any sentence.** Evidence opens directly beneath it.
- **Controls & findings.** The same map, now annotated — which step each control sits on and
  which steps have something wrong. Fourteen controls as a queue: `Enter` accepts, `N` not key.
- **Line walkthrough.** The one to watch. Pick SO-24188 and press `Enter` through seven steps.
  Expected step, expected control, expected evidence — against what actually happened. Step 5
  finds that the invoice went out seven days before the customer signed acceptance. Concluding it
  raises a finding that appears back in step 4, on the invoicing node of the map.
- **Control testing.** A labelled future concept: control → setup → population → evidence →
  results → conclusion, with the sample size showing the firm parameter that produced it.
- **⌘K.** Type `acceptance`, `override`, `credit`, or any process step, control or finding.
- **⌘Z.** Every decision is reversible. Nothing asks "are you sure?" except sign-off.

Press `?` for the keyboard sheet. ⌘K → *Reset the prototype* starts over.

---

## The mock engagement

Vandersteen Industrial Systems B.V. — a fictional Dutch manufacturer of conveyor systems,
revenue EUR 48.6m across two streams, EU-IFRS, audited by the fictional firm Kuyper & Bergman.
No real entity, person or engagement is depicted.

It is built to exercise the states the product has to handle: an ERP-driven order-to-cash flow,
warehousing outsourced mid-year to a third party, price overrides nobody reviews, reciprocal
approval of manual journals, an undocumented cut-off review, a consignment arrangement disclosed
only in a questionnaire, one contradictory answer across two sources, one drafted claim no source
supports — and one real transaction whose invoice date precedes the customer's acceptance,
which only the line walkthrough finds.

Coverage items, risk ids (`RSK-REV-*`) and control ids (`CTL-REV-*`) are the real ids from
methodology pack `revenue v0.1.0` in `../audit-engine/packages/methodology/`.

---

## What this prototype deliberately does not do

No authentication, database, tenancy or storage. No Anthropic API or any real inference. No
WebRTC, speech recognition or audio. No document ingestion, OCR or export generation. No
integrations. No process other than Revenue, no control testing, no sampling. Prior-year
comparison, the test plan and an editable RCM grid are out of scope by design — see
`UX-PLAN.md §12` for the reasoning on each.

Interactions are real: approving, editing, rejecting, resolving, undoing and marking not
applicable genuinely mutate state and are reflected on every screen and in the stage spine. The
*intelligence* is scripted — the point is the experience of the workflow, not a live model in a
demo.

---

## If this becomes production

The prototype is zero-build vanilla ES modules on purpose (`UX-PLAN.md §11`): it has to open on
a design partner's laptop in a meeting room with no toolchain and no internet. It is still
shaped to port: `app.css` is a token file, views are pure `state → HTML` functions that map onto
components, and the mock data follows the real Zod schemas in `../audit-engine/packages/domain`.

Before building the production frontend, read `UX-FINDINGS.md`. Four of the twelve findings
(F-01, F-02, F-05, F-10) add fields to records rather than changing behaviour, and are far
cheaper to decide before the first migration than after it.
