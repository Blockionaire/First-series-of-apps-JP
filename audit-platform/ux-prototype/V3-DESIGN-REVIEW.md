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

## The setup layer (added after V3)

Five screens above the engagement, in the same V3 system — see `SETUP-LAYER-V1.md` for the model.

**Clients** · a searchable list, not a CRM dashboard. One row per client with the live engagement's
state as a tag. Designed for hundreds: search first, no cards.

**Client detail** · the permanent home of the client. Profile as a quiet row group; engagements,
contacts and systems as their own sections with inline add forms. Contacts carry a `client contact`
tag on every row, because the one thing this screen must never imply is that adding a person creates
an account.

**New client** · a single page in five labelled groups, not a wizard. Only the legal name is
required; the primary is disabled until it is there.

**New engagement** · three stages, using the trace ribbon component as the stage indicator — the
same shape that shows progress through a transaction now shows progress through a form, which is
reuse rather than a new pattern. Scope is selectable cards; everything else is defaulted from the
client. The team stage became a row list rather than cards when it had to carry two facts per
person: the firm role as read-only context on the left, the engagement role as a select on the
right. A card cannot hold a control without becoming a form, and a row can.

**Firm people** · a structured list with firm role and access level in separate tags, and a callout
saying plainly that authentication is not built.

**The empty process state** · what Revenue looks like on an engagement with no loaded file. Three
answers in one screen — where you are, what the state is, what you can do — using the standard
empty block and a centred action row. Deliberately not a warning: a new engagement with no work on
it is a correct state, not a failure, so there is no amber, no red and no callout.

**Navigation** · no sidebar was added. Clients is reached from Work and ⌘K; firm people from a new
avatar menu. The process journey correctly does not render on any of the five.

### What is weak about it

1. **The engagement stage indicator is borrowed.** Reusing the trace ribbon is efficient and reads
   fine, but a form is not a transaction and the component's vocabulary (*corroborated*, *tracing
   now*) is one caption away from leaking into a setup screen.
2. **Client detail is long.** Four sections down a reading column, and it will only get longer.
   Above 1200px it wants two columns.
3. **Inline add forms appear in place and push content down.** Correct behaviour, slightly abrupt
   motion — they get the standard rise, nothing more.
4. **Engagement rows on Work now list every engagement including closed ones.** Honest, but the
   Work screen's job is what needs you today, and four rows is already one more than it wants.
5. ~~**The non-canonical Revenue state is a callout, not a designed screen.**~~ **Fixed in the
   integrity pass.** It is now its own screen behind a routing guard, with the client, the financial
   year and the phase in the header and three actions beneath the empty block. It is still built
   from the generic empty component, so weakness 6 below applies to it.
6. **The engagement-role select sits in a row's side slot.** It works and it is labelled, but the
   side slot was designed for tags and small buttons; a 150px select is the largest thing that has
   ever gone in one, and a second control would break it.
7. **Two "Edit" affordances now sit on client rows.** Contacts and systems each gained a ghost
   button on the right. They are quiet, but the client page is the densest row list in the setup
   layer and it is one affordance away from busy.

---

## The responsive canvas pass

The layout was one narrow column on a wide screen: Work at 780px and the Engagement page at 860px
meant roughly 550px of unused canvas either side of the application on a 1920 monitor, and a
process map that scrolled horizontally on a screen with room to show all of it. Seven named width
modes now replace four ad-hoc ones, and every view declares which kind of work it is rather than
picking a number — see `V3-DESIGN-DIRECTION.md` → **RESPONSIVE CANVAS & TASK WIDTH**.

**What got wider.** Work, Clients, Client profile, Engagement and Complete moved to *overview*
(1300); Revenue home, the two triage screens and the line walkthrough to *workspace* (1480); the
RCM to *data* (1600); Prepare, the process interview, control testing and open matters to
*standard* (1160).

**What did not.** The Decision Workspace is still 760px and the questionnaire still 640 — both are
fixed, not capped, because they are single-purpose surfaces. The working paper's document is still
68ch inside an 880px wrapper. The new-client and new-engagement forms are 960.

**What the width bought.** At 1440 the whole process map is on screen with no horizontal scroll, all
four judgement items sit above the fold, and the RCM shows six columns; at 1920 the map has room to
spare. Five screens lost roughly a third of their vertical length by arranging existing content in
two columns rather than stacking it — nothing was added to fill space.

**Three bugs the width exposed and this pass fixed.** `.sec__h` is used both as a header row and as
spacing on the sentence beneath a heading; being `display: flex`, any such sentence containing a
`<b>` was laid out as two or three columns — very visible at 1300px, wrong at any width. The
next-action card's title and description are `<span>`s inside a `<button>` and ran together on one
line. And `.grid2 .fgroup + .fgroup` gave the right-hand field of every pair a 16px top margin, so
its label sat below the left-hand one whenever only one of the two carried a hint.

### What is weak about it

1. **Two-column sections depend on the two sides being roughly the same height.** Controls and
   findings was tried as a pair and reverted: with no parked controls the left column is a heading
   and a sentence next to four finding cards, which reads worse than the stack. The helpers make
   the arrangement easy and give no warning when the content does not suit it.
2. **The split Attention Queue changes the reading order from one column to two.** The items stay
   numbered and priority-ordered, so it survives, but a queue is a sequence and a grid is not.
3. **`.lay` collapses at a viewport breakpoint, not a container one.** A `.lay` nested inside
   something narrow would keep two columns it cannot afford. Container queries would state the
   actual rule; this pass did not introduce them.
4. **The head-right tally drifts far from the title on a workspace-width screen.** At 1480 there is
   a metre of empty space between the page title and its two numbers, which weakens the pairing.
5. **The convergence divider on the process map is now very wide.** It was drawn as a full-width
   rule with a centred label, and at 1480 it reads more like a section separator than a join.

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
