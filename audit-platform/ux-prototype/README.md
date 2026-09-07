# Audit AI — Interim Platform UX Prototype

A high-fidelity, clickable prototype of the future Audit AI interim platform, built so that
auditors and design partners can experience the product before any production frontend exists.

**Second iteration.** The first version proved the product logic but felt like enterprise audit
software: a permanent sidebar, ten tabs exposing the data model, twenty decision tables and
forty-five bordered panels. `NEXT-GEN-UX-DIRECTION.md` is the critique and the direction that
replaced it. The first iteration is preserved at git tag `ux-v1` if you want to compare.

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
| `NEXT-GEN-UX-DIRECTION.md` | The critique of iteration one and the direction that replaced it. **Read this first.** |
| `UX-PLAN.md` | Iteration one's plan. Still the reference for scope, provenance rules and what is excluded |
| `DEMO-SCRIPT.md` | The nine-beat design-partner path, with presenter notes and the questions you will get |
| `UX-FINDINGS.md` | Twelve product and data-model gaps found while building, written for the engine track. No engine file was changed |
| **`audit-ai-prototype.html`** | **The whole prototype in one file. Download, double-click, done. Generated — do not edit** |
| `build-standalone.py` | Regenerates the file above from the source |
| `index.html` · `app.css` | Shell and the design system (tokens, primitives, components) |
| `js/data-sources.js` | The evidence base: walkthrough transcript, client questionnaire, three documents, auditor notes |
| `js/data-model.js` | Coverage (45 items), narrative (14 sections), 11 risks, 14 controls, 5 gaps, 10 open items |
| `js/state.js` | State, derivations, the exception model and the undo stack. Every headline number is computed here |
| `js/palette.js` | ⌘K — the navigation |
| `js/views/` | One module per stage |

## The journey

Four stages, not ten tabs:

```
UNDERSTAND ──▶ REVIEW ──▶ RESOLVE ──▶ COMPLETE
what we know   the judgements   what is    sign-off
and what we    the drafting     blocking   and export
still don't    could not make   us
```

Everything else — the matrix, the working paper, the questionnaire, the future cockpit, any
section, risk, control, coverage area or source — is two keystrokes away on **⌘K**.

Off the spine: the **client questionnaire** (a separate, plainer client surface) and the
**live walkthrough cockpit**, explicitly labelled as a future-state concept.

**Start with the guided demo** — the link on the Work screen, or `⌘K → Guided demo`. It sets each
screen up and puts the line to say at the bottom. `→` and `←` move between beats, `Esc` exits.

## Things worth doing

- **Understand.** Three gaps in plain English. Then open *Show methodology* to see the 45
  coverage items, fact keys, triggers and ISA references underneath. The engine is complex; the
  surface is not.
- **Review → Start.** Nine pipeline stages; watch the validation stage fail three statements.
- **Review, once drafted.** *Four need your judgement · ten sections are clean.* The whole
  product promise on one screen, before anything is asked of you.
- **Press Enter four times.** The contradiction first, with both sources side by side, then the
  three unsupported statements. Each has the correction pre-written.
- **Read the working paper, then click any sentence.** Evidence opens directly beneath it.
- **Review recommendations (controls).** Fourteen decisions as a queue, not a table. `Enter`
  accepts, `N` marks it not key. Try clearing all fourteen without the mouse.
- **⌘K.** Type `cut`, `override`, `credit`, or the name of any risk or control.
- **⌘Z.** Every decision is reversible. Nothing in the product asks "are you sure?" except
  sign-off.

Press `?` for the full keyboard sheet. ⌘K → *Reset the prototype* starts over.

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
