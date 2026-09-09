# V3 — Visual and Interaction Direction

The functional model is frozen (`PRE-DESIGN-FUNCTIONAL-FREEZE.md`). This document is the visual
and interaction standard built on top of it. One direction, decided — not options to choose from.

**On the references.** `zeno.law` and `anthropic.com` are both blocked by this environment's egress
proxy, so neither could be inspected directly. What follows is drawn from working knowledge of both
and from the qualities named in the brief. Where a specific claim about either product is made, it
should be checked against the live sites before being treated as fact.

---

## 1. What is wrong with V2, specifically

V2 was designed against a rule — *typography and whitespace, never boxes* — and held to it too
literally. The result is coherent and underweight.

**It is a white page with hairlines on it.** Almost every surface is `#fcfcfa` or `#ffffff`. There
is no depth, so nothing can be visually prioritised except by size, and size is doing all the work
alone.

**The type is too small and too grey.** Body is 15px, metadata 12.5px at `#8b95a1`, and there is a
lot of metadata. Four hours in this is tiring. The scale also compresses at the top: `t-title` 30px
and `t-h` 20px is not enough separation to carry a whole screen.

**Buttons are apologetic.** 7px × 14px, 14px text, a 1px inset ring. The primary action does not
read as more important than the four things next to it, and on several screens there are four or
five buttons of near-equal weight. The single most important question — *what should I do next?* —
is answered by reading, not by looking.

**The 3px inset left rule is doing every job.** Attention, contradiction, evidence, callout,
selected claim and focus item all use the same device in a different colour. It is a signature that
became a crutch.

**Everything has the same density.** One `.wrap` at 940px, one `.head`, one `.rows`. The working
paper, the RCM and the sign-off screen have identical rhythm, and they are not the same kind of
work. The brief is right that this is V2's biggest weakness.

**There are no icons at all**, so every object type has to be read as a word, every time.

**It is generic on the accountability test.** Replace the audit words with legal or medical words
and nothing about the interaction would look wrong. The audit-native ideas — evidence beneath a
claim, a branching process, review by exception — are present functionally but not *visually
asserted*.

**Quantified:** 1 accent colour, 2 surfaces, 0 icons, 1 elevation, ~40% of styling still inline.

---

## 2. What is preserved, without negotiation

Everything in the freeze document. In interface terms specifically: the seven-step journey and its
order; the engagement hierarchy; the three process variants and the branching map; review by
exception with triage → focus; evidence inline beneath the claim, never in a side panel by default;
undo instead of confirmation; ⌘K as the only navigation for everything off the spine; keyboard
decisions in every queue; the two-run generation split; per-control test state; the review-point
loop; and every piece of copy that distinguishes *unknown* from *not applicable*, *proposal* from
*conclusion*, and *carried forward* from *resolved*.

No visual idea in this document is worth breaking one of those.

---

## 3. What is taken from Zeno

The qualities, not the appearance:

- **Warmth as the ground state.** A warm off-white application background instead of white makes
  paper-white content surfaces read as *content* rather than as the page itself.
- **Tactility in the primary action.** A filled, confident primary button with real padding, so the
  next step is visible from across the room.
- **Softness over hairlines.** Grouping by surface and space, with borders as the exception.
- **Source and claim as one object.** Evidence belongs to the sentence, not to a panel.
- **Generosity on the things that matter.** The most important content on a screen gets more room
  than everything else, not the same amount.

**Not taken:** palette, typeface, logo, card shapes, layouts, illustration, any branded asset.

---

## 4. What is taken from Anthropic

- **Editorial confidence.** Large type used as the primary structural device, with real size jumps
  rather than a smooth ramp.
- **A point of view about composition.** Asymmetry and deliberate emptiness where it serves the
  reading, instead of a centred column on every screen.
- **Warm neutrals with one unmistakable accent**, used sparingly enough that it always means
  something.
- **Restraint as personality.** The confidence to leave a screen quiet.

**Not taken:** the ivory-and-clay palette itself, the display typeface, the marketing-site
composition.

---

## 5. The Audit AI direction: *Quiet Richness*, and one original idea

If V3 can be described as "Zeno for audit", it has failed. So the visual system is built around one
idea that belongs to audit and to nothing else:

> **Elevation carries evidentiary meaning.**
>
> The **work product rises**. The **evidence sits beneath it**.

Concretely, and consistently, everywhere:

| Layer | Treatment | What it means |
|---|---|---|
| **Ground** | warm ivory, no border | the application |
| **Raised** | paper white, soft shadow, lifts on hover | work product — the narrative, a decision, a finding |
| **Recessed** | tinted, inset shadow, no lift | evidence, sources, quotes, the client's own words |
| **Attention** | raised + a semantic edge | something that needs a person |

This is why the **Source Lens** works: clicking a sentence in a raised document opens a *recessed*
surface directly beneath it. The user is looking *through* the work product *into* what it rests
on. That gesture is legible before anyone explains it, and it is the interaction the product should
become known for.

Everything else in this document serves that idea.

---

## 6. Colour — *Ledger*

A warm neutral foundation with a single deep mineral-green brand ink.

```
GROUND        #F3F1EB   warm ivory — the application background
SURFACE       #FAF8F4   workspace, one step lighter
PAPER         #FFFFFF   document and work-product surfaces
RECESSED      #EDEBE3   evidence, sources, quotes
SUNK          #E5E2D8   inputs, wells, the deepest surface

INK           #1A1C18   warm near-black
INK-2         #40443C   secondary body
INK-3         #6A6F64   supporting
INK-4         #8C9184   metadata — never smaller than 13px
INK-5         #B0B4A8   disabled, ticks

LINE          #E4E1D6   hairline
LINE-2        #D3CFC0   stronger edge
```

**Brand accent — mineral green.** Deliberately dark: it reads as an ink, so it can fill the primary
button without competing with the success green.

```
ACCENT        #22392F   primary fill, wordmark
ACCENT-HOVER  #2E4B3E
ACCENT-MID    #3F6B57   links, focus ring, active navigation
ACCENT-SOFT   #E6EDE7   selection tint
ACCENT-LINE   #C5D5C9
```

**Semantic, muted.** Meaning, not decoration. Never a filled badge, never a traffic light.

```
OK       #3F7350   soft #E9F0EA   line #C6DBCB     supported · approved · corroborated
WARN     #9C6A1B   soft #F8EFDC   line #E5D2A8     needs attention · incomplete
DANGER   #A5412F   soft #F7E9E5   line #E6C5BB     contradiction · exception · blocked
CONCEPT  #5B5478   soft #EFEDF4   line #D2CDE0     future-state, used once
```

Contrast: ink on ground is 15.2:1; ink-4 on ground is 4.6:1 at 13px; every semantic colour on its
soft tint clears 4.5:1. **No state is ever communicated by colour alone** — each has a dot shape, a
word, or an icon beside it.

---

## 7. Typography

Two worlds, deliberately different, no web fonts (the bundle must work offline from `file://`).

**Interface — sans.** `Inter` where installed, then `Segoe UI Variable Display` (Windows 11),
`-apple-system`, `Segoe UI`, `Roboto`. Tight tracking on headings, tabular numerals everywhere.

**Work product — serif.** `Iowan Old Style`, `Palatino Linotype`, `Palatino`, `Charter`, `Georgia`.
Used for the narrative, evidence quotes and the thing being decided — the content that is, or
becomes, the audit file.

The distinction is the point: **software is sans, the audit file is serif.**

```
display   34 / 1.15 / 600 / -0.022em    screen owner
title     26 / 1.22 / 600 / -0.019em    section owner
h         19 / 1.35 / 600 / -0.011em    group
body      15.5 / 1.62                   interface prose
doc       18.5 / 1.78 serif             the working paper
quote     16 / 1.68 serif               evidence
sub       14.5 / 1.55                   supporting
meta      13 / 1.5                      metadata — the floor
eyebrow   11.5 / 600 / .09em / caps     label
num       32 / 600 / -0.02em tabular    counts
```

Everything is larger than V2. The metadata floor moves from 12.5px to **13px** and the colour from
`#8b95a1` to `#8C9184` — still recessive, comfortably readable for four hours.

---

## 8. Header

A **horizontal application frame**. No permanent sidebar, at any width.

**Row 1 — 56px, sticky, ground-coloured with a hairline.**

```
[◆ Audit AI]   Vandersteen › FY2026 › Interim › Revenue        Saved · [⌘K Search] [?] [SB]
```

The wordmark is a small mineral-green mark plus the name. The breadcrumb is the *context*, always
present and always clickable: client → engagement → phase → process. The right cluster is
deliberately four items and no more: save state, a search *pill* that shows its own shortcut, help,
avatar. No notification bell — nothing in this product needs one yet.

**Row 2 — the Process Journey, 60px.** Described below.

Together 116px of chrome, against V2's 64px — but V2's 64px carried a bare identity line and a tab
strip. The extra 52px buys permanent orientation and the single most useful navigation in the
product.

---

## 9. Process Journey

Seven steps, connected, stateful. Not tabs.

Each step is a small stack: a **state marker**, the **step name**, and a **compact state caption**.
A hairline connector runs between markers and *fills* behind completed steps, so progress is
readable as a line, at a glance, without reading a word.

| State | Marker | Name | Caption |
|---|---|---|---|
| done | filled green ring with a check | ink-3 | green |
| current | filled accent dot with a ring halo | ink, 600 | ink-3 |
| needs attention | amber or red dot | ink | semantic |
| open | hollow ring | ink-2 | ink-4 |
| later | small hollow tick | ink-5 | ink-5 |

The current step also carries a 2px accent underline. Later steps are dimmed but never disabled —
they explain *why* they cannot start, which V2 got right and V3 keeps.

---

## 10. Surfaces

Five, each with one job. This is §5 made mechanical.

```
.s-ground     the page                       no border, no shadow
.s-surface    a grouped region               1px line, radius 12
.s-paper      work product                   white, shadow-1, radius 12, lifts on hover
.s-recessed   evidence and sources           tinted, inset 1px line, radius 10, never lifts
.s-sunk       inputs and wells               deeper tint, inset line, radius 9
```

Shadows are almost invisible and only ever used to lift:

```
--sh-1  0 1px 2px rgba(26,28,24,.04), 0 1px 1px rgba(26,28,24,.03)
--sh-2  0 2px 6px rgba(26,28,24,.05), 0 10px 24px -10px rgba(26,28,24,.08)
--sh-3  0 24px 64px -14px rgba(26,28,24,.22), 0 4px 12px rgba(26,28,24,.07)   overlays only
```

Radius: **6** control · **9** button, input · **12** surface, card · **16** overlay · **999** pill.

Attention is a **2px top-edge or left-edge accent on a raised surface** plus a soft tint — a
combination V2 could not make, because V2 had no raised surface to put an edge on.

---

## 11. Buttons

Four weights, and only one primary per screen region.

```
PRIMARY     accent fill, white text, 10px 18px, 15px/600, radius 9, shadow-1
            hover: lighter fill + 1px lift    active: no lift
SECONDARY   paper fill, 1px line-2, ink-2, same metrics
            hover: line darkens, surface lifts to paper-white
GHOST       no fill, no border, ink-3, 8px 12px
            hover: recessed tint
SEMANTIC    approve (ok) / exception (danger), fill only where the meaning is the action
```

Sizes: `sm` 8×13 / 13.5px · default 10×18 / 15px · `lg` 13×24 / 16px.

Requirements met by the component, not by each caller: consistent 38px default height, icon slot,
optional shortcut chip rendered subtly on the right, `:focus-visible` ring in accent-mid at 2px
with 2px offset, and a disabled state at 40% that keeps its shape.

**The rule that matters:** if a screen region needs two primaries, one of them is not a primary.

---

## 12. Iconography

One family, drawn in-house: **1.5px stroke, 20px grid, round caps and joins, no fill.** Inline SVG,
`currentColor`, so it inherits state colour for free and costs nothing offline.

Twenty-two icons covering the object types the product actually has — transcript, document,
questionnaire, note, evidence, contradiction, question, finding, control, walkthrough, test, review
point, signature, variant, map, step, plus the interface set: search, check, chevron, arrow, undo,
keyboard, user, clock.

Rules: an icon never appears without a label except where the label is the tooltip; icons mark
**object type**, never decorate; and there is **no sparkle, no robot, no brain** — the product does
not announce that it contains AI.

---

## 13. Process Understanding Map — signature #1

The map has to say *this is not one process* before anything is read.

**Lanes, not a flowchart.** Two lanes — goods and service — each a horizontal run of nodes, meeting
at a convergence bar where all three variants join. The lane label sits above the run. A step that
is not on every variant of its lane says so in words (*machine sales only*), which is more precise
than a colour key and needs no legend.

**Nodes are tactile.** Paper surface, radius 12, 1px line, real padding, and they lift on hover.
Each carries: an ordinal or id, the step name at 14px/600, the actor at 12.5px, and a marker row
that changes by mode — controls and findings in step 4, trace verdicts in step 5.

**States are edges, not fills.** A 2px bottom edge for *no control identified*; a soft green wash
and green edge for *corroborated*; a danger edge and tint for *exception*; 45% opacity plus an
explicit caption for *not on this path*. Never a filled block of colour.

**Clicking a node opens detail beneath the map, not on another screen** — what we understand, the
evidence, the controls, the findings, the trace observation. The map stays where it is.

Explicitly not: BPMN, swimlane diagramming, a node-graph canvas, drag-and-drop, zoom controls.

---

## 14. Attention Queue — signature #2

The triage screen's whole job is one sentence: **41 statements checked · 37 ready · 4 need you.**

The clean work is stated in one quiet line and then dismissed. The four items get the screen. Each
is a raised card carrying:

```
01  ── CONTRADICTION ──────────────────────────────── ordinal + type, with icon
Credit management                                     context
Two sources disagree on who can change a limit.       the thing itself, serif, 19px
Blocks · Process narrative · Control C-02             what it holds up
                                            Review →  one action
```

Ordinals matter: they say *four, and they are ordered*. The type strip is coloured by kind and
carries its icon. `Blocks` is the line that makes an auditor click, and it is why the Dependency
View (§17) is the same data rendered larger.

Hover lifts the card and reveals the action. `Enter` opens the first. This screen should be the one
people remember from the demo.

---

## 15. Decision Workspace — signature #3

Every professional judgement in the product uses one grammar: contradictions, unsupported claims,
controls, findings, walkthrough verdicts, test conclusions.

```
← Back        Controls · 3 of 14                     small, quiet
──────────────────────────────────────────────────
On the process at  Credit check                      where it lives
Discounts above 12% block the order                  THE THING — 26px, 600
until the Commercial Director releases it

Why this may be a key control                        supporting blocks
Owner · Frequency · Nature · Evidence                facts
▸ Supported by 3 sources                             recessed, on demand
▸ Show the six criteria

Proposed  Key control                                the system's view, labelled
──────────────────────────────────────────────────
[Accept — key control ⏎] [Not key N] [Carry forward C]   DECISION DOCK
```

The **decision dock** is a sticky bar at the bottom of the workspace with a ground-tinted backdrop
and a top hairline. It never scrolls away, it always shows the shortcuts, and it is the only place
on the screen with a primary button. Deciding advances the queue in **160ms** — the card leaves
upward, the next arrives from below — and the undo bar confirms what happened.

Measure is capped at 62ch. The thing being decided is set in the serif, because it is going into
the file.

---

## 16. Source Lens — signature #4

The interaction the product is named by, per §5.

Click any sentence in the working paper. The sentence stays exactly where it is and gains an accent
left edge. A **recessed** surface opens directly beneath it in 140ms, inside the same measure,
carrying: source-type icon, source name, speaker, locator, and the exact passage in serif with the
supporting words marked in a soft accent underline.

Two sources → both, stacked, labelled *corroborated by*. A contradiction → both, one with an ok
edge and one with a danger edge, and the conflicting phrases marked in each. Nothing supports it →
the recessed surface says so plainly and offers what the sources *do* say.

The eye never leaves the line. No panel, no modal, no navigation. This is the single most important
interaction to get right, and it is why the recessed surface exists as a token.

---

## 17. Dependency View — signature #5

Blocking is made visual without a graph. When an item blocks other work, it renders as a small
fan-out beneath the item: a short vertical connector into two or three targets, each with its
object icon, its name, and its state.

```
This contradiction is blocking
  ├── Process understanding · Credit management      needs judgement
  ├── Control C-02 · Credit limit release            cannot conclude
  └── Completion · No unresolved contradictions       gate unmet
```

When it resolves, the connectors fade and each target animates to its cleared state over 200ms,
staggered by 40ms. That stagger is the only piece of ornamental motion in the product, and it is
earned: it is the product showing its work.

---

## 18. Screen density — one template does not fit seven steps

| Screen | Density | Measure | Character |
|---|---|---|---|
| Work | calm | 780px | one question, enormous next action |
| Engagement | calm | 1080px | hierarchy, phases as a rail |
| Process home | spatial | 1240px | map first, next action second |
| Prepare | grouped | 940px | carried context as recessed cards |
| Process interview | medium | 940px | attention items as raised cards |
| Generation | focused | 720px | five plain-language stages, technical detail on demand |
| Triage | focused | 900px | the Attention Queue |
| Decision | focused | 760px | Decision Workspace |
| Working paper | editorial | 68ch | document, rail, Source Lens |
| Controls | spatial → focused | 1240px → 760px | map, then queue |
| Line walkthrough | rich | 1240px | variants, then trace with a progress ribbon |
| Control testing | structured | 1040px | staged, with a real results table |
| Resolve | grouped | 940px | by impact, with dependencies |
| RCM | dense | full | a proper data grid |
| Complete | calm | 860px | readiness, then signature |
| Questionnaire | generous | 640px | one question, large type, mobile-first |

**The RCM gets a real table.** V2's anti-table rule was right for narrative and wrong for a matrix:
sticky header, grouped risk rows, 13.5px tabular figures, subtle row separation, expandable detail,
search and filter chips, full keyboard navigation. Tabular information gets a table.

---

## 19. Motion

Functional only. Nothing decorative, nothing slow.

```
--t-fast    120ms   hover, focus, press
--t-base    160ms   queue advance, disclosure, node state
--t-slow    220ms   overlays, lens, dependency clearing
--ease      cubic-bezier(.2, .8, .3, 1)
```

Nine moments have motion and nothing else does: page enter (6px rise, 120ms), Source Lens open,
queue advance, node state change, palette open, undo bar, dependency clearing, sign-off
progression, and the generation stages. All of it is wrapped in `prefers-reduced-motion`.

---

## 20. Component system

Twenty-six patterns in CSS, with matching helpers in `ui.js` — enough to be coherent, not so much
that it becomes a framework:

`AppHeader` · `Breadcrumb` · `ProcessJourney` · `NextAction` · `Card` · `CardGrid` ·
`AttentionQueue` · `AttentionItem` · `DecisionWorkspace` · `DecisionDock` · `SourceLens` ·
`EvidenceQuote` · `AuditStatus` · `StatBar` · `ProcessMap` · `ProcessNode` · `MapDetail` ·
`DependencyView` · `WorkingPaper` · `ReadingRail` · `TraceRibbon` · `TestStage` · `AuditGrid` ·
`ReviewPoint` · `CompletionGate` · `QuestionnaireCard`.

Inline styles are removed wherever a pattern repeats. The remaining ones are one-offs that genuinely
occur once.

---

## The tests this direction has to pass

1. **Could this screenshot come from generic enterprise SaaS?** The lane map, the Attention Queue,
   the Source Lens and the decision dock all have to answer no.
2. **Replace the audit words with legal words — does it still make sense?** Process variants, line
   walkthrough, corroborated-vs-exception and the completion gates should not survive the
   substitution.
3. **Can an auditor find the next action in two seconds?** One primary button per region, and a
   Next Action block on every overview.
4. **Four hours without fatigue?** Warm ground, 13px metadata floor, no pure-white full screens, no
   animation that repeats.
5. **Partner sees control. Auditor feels speed.** Provenance and gates are always one click away;
   every queue is fully keyboard-operable.
