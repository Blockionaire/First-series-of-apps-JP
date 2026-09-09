# V3 Design Review

Screen by screen: the V2 problem, the V3 answer, and — the part that matters — what still is not
good enough. Written after implementation, against the tests in `V3-DESIGN-DIRECTION.md`.

**On the references.** `zeno.law` and `anthropic.com` are both blocked by this environment's egress
proxy. Neither could be inspected. The Zeno quality test in §62 of the brief therefore **has not
been run against the live site** — it is the one acceptance criterion outstanding, and it should be
run by eye before this design is treated as settled.

---

## The system

| | V2 | V3 |
|---|---|---|
| Surfaces | 2 (paper, white) | 5, with elevation carrying meaning |
| Accent colours | 1 (navy) | 1 brand (mineral green) + 4 semantic |
| Icons | 0 | 30, one family, drawn in-house |
| Type scale | 8 steps, 30px top | 11 steps, 34px top, 13px floor |
| Buttons | 1 shape, 4 tints | 4 weights, one primary per region |
| Motion | 2 transitions | 4 durations, 9 named moments |
| Inline styles | ~40% of markup | ~4%, all genuine one-offs |
| CSS | 633 lines | 1,060 lines, fully tokenised |

**The one original idea:** elevation is evidentiary. The work product rises (`.s-paper`); the
evidence sits beneath it (`.s-recessed`). Every claim, quote, source panel and expected-evidence
block in the product obeys it, which is what makes the Source Lens read as *looking through* the
working paper rather than *navigating away from* it.

---

## Screen by screen

### Work · `#/`
**V2:** a next action rendered as a list row that looked exactly like the three rows beneath it.
**V3:** the Next Action is its own component — 32px padding, 23px title, a circular affordance that
slides on hover. Everything else recedes to a quiet list. One screen, one obvious thing to do.

### Engagement · `#/engagement`
**V2:** four phases as bottom-bordered text; processes as hairline rows.
**V3:** phases are surfaces, with the active one carrying the accent tint; processes gain type
icons and a real progress figure. Hierarchy is visible before it is read.

### Process home · `#/revenue`
**V2:** the map was a strip of thin-bordered boxes with `◆◆◆` for controls.
**V3:** the map leads the screen, in lanes, with a dashed convergence rule and a real
"all variants converge here" label. Nodes are paper surfaces that lift. Controls and findings are
icons with counts. The Next Action sits directly beneath it, then variants as cards.

### Prepare · `#/prepare`
**V2:** eight identical hairline lists.
**V3:** carried context becomes a two-column card grid with source-type tags; changes since last
year are amber-edged cards; systems and people sit side by side. The confirm action is a large
primary with nothing competing.

### Process interview · `#/interview`
**V2:** clarifications were 17px-tall rows with 13px actions.
**V3:** each is an Attention Queue item — ordinal, type strip with icon, the question in 19px
serif, why it matters, and its actions. This is the screen where V3 most obviously stops looking
like a table of database rows.

### Generation · `#/understanding`
**V2:** nine technical rows with model names, as the default experience.
**V3:** five plain-language phases with live state; the nine stages, model names and outputs are
behind *Show the technical stages*. The result explicitly says nothing was concluded.

### Triage · `#/understanding`
**V2:** "4 need your judgement" as a heading over hairline rows.
**V3:** the tally states **39 ready · 4 need you** and the four own the screen as queue cards, each
carrying a `Blocks` line naming what it holds up. The clean 39 are one sentence.

### Contradiction · Decision Workspace
**V2:** two bordered cards with plain quotes.
**V3:** two recessed evidence surfaces, green- and red-edged, with **the exact conflicting phrases
marked** inside each quote; a Dependency View showing the three things the decision affects; and
three numbered option cards in a sticky dock.

### Unsupported claim · Decision Workspace
**V2:** a "suggest" box and four equal-weight buttons.
**V3:** the statement in serif at 22px, what the check looked for behind a disclosure, the supported
wording in document type, and a dock with one primary. The dependency line says what it blocks.

### Working paper · read mode
**V2:** the document sat directly on the page background with a 172px tick rail.
**V3:** a real paper surface with 64px padding, an interactive section rail, and section state as
tags. Claims show a source count on hover.

### Source Lens
**V2:** a white bordered box under the claim.
**V3:** a recessed, inset-shadowed surface that opens in 220ms, with a source-type icon, speaker,
locator, and the supporting phrase marked in the quote. When nothing supports the claim it says so
in the same place rather than showing an empty panel.

### Controls & findings · `#/controls`
**V2:** the analysis was invisible — controls simply existed.
**V3:** step 4 opens with its own run, then the annotated map, then queues. Findings are queue
cards. Concluded findings show the platform proposal beneath the auditor's conclusion.

### Control decision
**V2:** a facts list and five same-weight buttons.
**V3:** Decision Workspace with a criteria summary (`5 of 6 criteria met`) as a flag, the six
criteria behind a disclosure with per-criterion tags, a labelled proposal strip, and a dock whose
note explains that parking is not concluding.

### Finding decision
**V2:** Modify opened five stacked fields with no labels.
**V3:** a labelled form inside the workspace — finding, description, severity, impact, remediation
— under a heading that says the proposal is kept.

### Line walkthrough · `#/trace`
**V2:** variants as `.vcard` blocks with text status.
**V3:** each variant carries a state tag; candidate transactions are cards, with the suggested one
accent-edged. The requirement decision is a warn-toned callout, so an undecided variant is visible
from across the room.

### Transaction trace
**V2:** a compact map above the step, and untraced steps only in a list at the end.
**V3:** a **progress ribbon** in the trace header showing every step of *this transaction* with five
distinct states — corroborated, exception, tracing now, not traced, and *not yet occurred* /
*not in this variant* rendered dashed and dimmed. The distinction the freeze document insists on is
now visual.

### Control testing · `#/testing`
**V2:** results as hairline rows.
**V3:** the six stages in a bordered flow; **results as a real table** with a sticky header, because
they are tabular. Scope decisions per control carry state tags; the un-workpapered controls get an
honest placeholder that still demands a conclusion.

### Resolve · `#/resolve`
**V2:** two hairline lists, "blocking" and "everything else".
**V3:** grouped by impact, each item a card with its type icon, origin, a **Dependency View** of
what it blocks, and — where a questionnaire answer settled it — the evidence inline.

### Complete · `#/complete`
**V2:** gates as hairline rows with "met"/"open" text.
**V3:** gates carry check and gate icons and `met` tags; the tally reads `12/12`. Review points are
their own component with a serif quote of what the reviewer wrote and a disabled resubmit until
they are answered.

### RCM · `#/matrix`
**V2:** the anti-table rule applied to a matrix, producing stacked prose rows.
**V3:** a genuine data grid — sticky header, 13.5px tabular figures, grouped risk signals with
`↳ same signal` continuation, live search, four filter chips with counts, conclusion tags. This is
the biggest single reversal in V3 and the right one.

### Client questionnaire · `#/questionnaire`
**V2:** desktop-shaped, 24px question, small buttons.
**V3:** 27px question, a progress bar, a large primary Send, and a mobile breakpoint that makes the
three answer buttons full-width. No methodology language anywhere.

### Command palette
**V2:** a plain list.
**V3:** a search-icon header, per-item type icons, accent-tinted selection, a footer with real key
chips.

### Live cockpit · `#/cockpit`
**V2:** three equal columns competing for attention.
**V3:** the conversation is a wide reading canvas in serif; coverage and suggestions are a single
quiet 320px rail. The person is the subject of the screen, which is the point.

---

## What is still not good enough

Honest list. None of these are blocking, all of them are real.

1. **The Zeno comparison has not been made.** Blocked by egress. Until someone puts the two side by
   side, "comparable product craft" is a claim, not a finding.
2. **The journey bar is the weakest premium element.** It is correct and legible, but the connector
   line between markers is a plain 18px rule and the whole bar still reads as competent rather than
   distinctive. It is the most-seen component in the product and deserves another pass.
3. **The Dependency View is under-used.** It exists on contradictions, unsupported claims and open
   matters. It should also appear on a control blocked by an open item, and on the completion gates,
   where "what is blocking this" is the entire question.
4. ~~**The map has no vertical connector at the convergence.**~~ **Fixed during this pass.** The
   lanes now join through a drawn elbow-and-arrow glyph into the merge lane, labelled *all three
   variants converge*. It still reads as a divider more than a diagram; a version that traced each
   lane's last node into the merge would be better, and would need real layout measurement.
5. **Prepare is still long.** Seven sections down a 1000px column. The content is right; the shape
   is a scroll. It probably wants two columns above 1200px.
6. **Empty states are plain.** Icon, heading, sentence, button. They are calm but they are the most
   generic screens in the product.
7. **The tally block is doing a lot of work.** It appears on eight screens as the head-right
   element. It is not a metric tile — it has no border of its own on most screens — but it is
   heading that way, and one more use would tip it.
8. **`.dock` uses a gradient mask over a fixed margin.** It works, but it is the one piece of CSS in
   the system that would break awkwardly if a decision workspace ever needed a different page
   background.
9. **No dark mode.** Not asked for, correctly out of scope, but the token system would support it
   and auditors work late.
10. **Motion is now delivered but barely exercised.** Page enter, lens, palette, undo, node states
    and the staggered dependency-clearing (40ms per row) are all implemented. But the cascade only
    fires on a resolved open matter, which is the one place it currently appears — the moment it was
    designed for. That is one use for a piece of bespoke motion.

## Tests, honestly scored

| Test | Verdict |
|---|---|
| Could this be generic enterprise SaaS? | **No** for the map, attention queue, source lens, trace ribbon, decision dock. **Yes, still** for the empty states and the plainer list screens. |
| Replace audit words with legal words — still coherent? | **No** — variants, corroborated-vs-exception, line walkthrough and the completion gates do not survive substitution. Passes. |
| Next action findable in two seconds? | **Yes** on every overview. One primary per region is enforced by the component, not by discipline. |
| Four hours without fatigue? | **Probably.** Warm ground, no pure-white full screens, 13px metadata floor, no repeating animation. Untested with a real user, which is the only test that counts. |
| Partner sees control, auditor feels speed? | Provenance is one click from any claim; every queue is keyboard-complete; gates and proposals are always visible. **Yes, on the evidence available.** |

## Regression

Five Playwright suites pass with no runtime errors: route integrity (14 routes), 66 state-model
assertions, 48 UI-walkthrough assertions driving the full seven-step workflow through clicks and
keys, undo/reset over the whole state model, and the standalone bundle over `file://`. No
functional behaviour in `PRE-DESIGN-FUNCTIONAL-FREEZE.md` was changed.
