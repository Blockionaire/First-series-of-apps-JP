# Next-Generation UX Direction

The v1 prototype proved the product logic. It did not prove the product *feeling*. This
document is the critique and the replacement direction.

The benchmark is not "does this look like good audit software?" It is:
**"does this feel like what audit software should have become?"**

Primary daily user: the 22-year-old assistant and the 28-year-old senior who will live in
this product for hours a week. They will not read a manual. They already know ⌘K.

---

## 1. What makes the current prototype feel traditional

Not opinion — a count of what is actually on screen.

| | v1 | Why it reads as 2012 |
|---|---|---|
| Bordered panels | **45** | Every idea is a box with a header. Boxes inside boxes inside a page |
| Data tables | **20** | The default answer to "show several things" is a grid |
| Metric tiles | **32** | Six-to-eight number tiles per screen: the dashboard cliché |
| Modal drawers | **10** | Routine actions interrupt with a scrim |
| Permanent nav tabs | **10** | The engine's object model, exposed as navigation |
| Chrome above content | **~184px** | Breadcrumb + title + tabs + status bar, on every screen |

### The six specific failures

**1. The tab bar is the data model.** `Overview · Walkthrough · Coverage · Documentation ·
Risks · Controls · Matrix · Open items · Sign-off · Export` is a list of database tables
wearing a navigation costume. It forces the auditor to know how *we* store things in order
to do *their* job. No modern product does this. It is the single worst thing in v1.

**2. Nothing is prioritised, so everything is equal.** The risks screen shows eleven rows
with identical weight. Three of them are fraud-related and one cannot be concluded at all —
but they look the same as the routine eight. The product knows which items need judgement
and refuses to say so. That is a wasted promise: *AI does the routine work, the auditor
spends time where judgement is required.*

**3. Decisions are table rows.** Twenty-five separate `[Accept] [Modify] [Reject]` button
triplets in cramped table cells. This is data entry, not professional judgement. It also
means the eleventh decision gets less thought than the first, which is exactly backwards
from what an audit needs.

**4. All complexity, all the time.** The coverage screen opens with 45 items, 113 fact
chips, snake_case fact keys and pack ids. It is a beautiful representation of the
methodology and a poor representation of the auditor's question, which is simply: *what do
we still not know?*

**5. The source panel taxes every pixel.** 358px of permanent right-hand column, present
whether or not anything is selected, pushing the document — the thing being reviewed — into
a ~700px middle strip. The most important content gets the least space.

**6. The AI advertises itself.** `AI draft`, `AI: likely key`, `AI proposes`. Every label is
a reminder that a machine wrote this, which invites the auditor to distrust the interface
rather than to read the work. Intelligence should be felt in the workflow, not announced in
a badge.

### What is genuinely good and must survive

Structured methodology · human approval · provenance on every claim · the needs-source gate ·
contradictions blocking downstream objects · coverage at fact level · risks and controls
connected to the walkthrough · sign-off gates · review by exception · professional scepticism.

None of this is being simplified. Only the way it reaches the eye.

---

## 2. The new interaction philosophy

Five principles, each with a rule you can hold a screen against.

**CALM** — *Nothing on screen unless it serves the current task.*
One accent colour. Hairlines instead of borders. No metric tiles. No panel headers. The
question is never "how do we display this?" but "does the auditor need this right now?"

**CONTEXTUAL** — *The product knows what you are doing and offers only that.*
Actions live next to the thing they act on. Navigation is a consequence of the work, not a
menu you consult beforehand.

**EVIDENCE-FIRST** — *The document is the interface.*
Generated documentation gets the whole workspace. Evidence appears where the eye already is,
inline beneath the claim, and disappears when you move on.

**EXCEPTION-DRIVEN** — *Clean work is absorbed; judgement is presented.*
The product never asks for equal attention on unequal items. It opens by separating the
routine from the judgement and hands you the judgement, one item at a time.

**INVISIBLE AI** — *Intelligence is experienced, not labelled.*
"Draft", "Suggested", "Needs support", "Potential key control". Never "AI". The word appears
once, in the export footer, where a regulator needs it.

### The one-sentence model

> **The auditor's work in this product is a queue of judgements, wrapped in a document they
> can read.** Everything else is plumbing and belongs behind ⌘K.

---

## 3. Proposed information architecture

### What disappears

The permanent dark rail. The breadcrumb trail. The ten-tab bar. The status strip. The
separate Matrix, Export and Settings destinations. Clients and Engagements as browsable
sections.

### What replaces it

```
┌────────────────────────────────────────────────────────────────────────┐
│  Vandersteen · Revenue                                    Saved   ⌘K   │   28px
├────────────────────────────────────────────────────────────────────────┤
│  Understand 84%  ·  Review 4 need you  ·  Resolve 6  ·  Complete       │   36px
└────────────────────────────────────────────────────────────────────────┘
                              64px of chrome, down from 184
```

**One line of identity, one line of progress.** That is the entire permanent frame.

**The stage spine** is not a tab bar. Tabs are peers you choose between; these are four
states of one piece of work, in order, each carrying a live count of what it still owes you.
It answers "where am I and what is left?" — which the tab bar never did — in less than half
the height.

**⌘K is the navigation.** Everything not on the spine is reachable in two keystrokes:
sections, risks, controls, coverage items, sources, other engagements, and *actions*
("approve section", "show only unresolved", "export"). This is how the target user already
navigates Linear, Notion, Raycast, GitHub, Slack. Giving them a menu instead is a downgrade
they will feel immediately.

The Matrix becomes a view of Review, reachable by ⌘K. Export becomes the end of Complete.
Settings becomes a ⌘K action. None of them deserve permanent real estate on a screen the
auditor stares at for three hours.

---

## 4. The new Revenue journey

```
UNDERSTAND ──────▶ REVIEW ──────▶ RESOLVE ──────▶ COMPLETE
what we know      the judgements   what is still    sign-off
and what we       the AI could     blocking us      and export
still don't       not make
```

Four verbs the auditor actually uses. The modules still exist underneath — coverage,
narrative, risks, controls, gaps, open items, RCM — but the auditor moves through *stages of
their own work*, not through our storage.

Each stage has a single primary action and states its own completion condition:

| Stage | Opens with | Done when |
|---|---|---|
| **Understand** | "Revenue understanding — 84%. Three things need clarification." | Coverage sufficient, mandatory items addressed |
| **Review** | "10 sections are clean. 4 need your judgement." | Every section decided, every recommendation answered |
| **Resolve** | "6 open items. 1 is blocking two conclusions." | Nothing unresolved, or each carried forward with a reason |
| **Complete** | The gates, and what is still red | All gates met, signed |

Crucially the spine is **not a wizard**. You can be in any stage at any time; the counts just
tell you what each still owes. A senior who wants to read the narrative before finishing
coverage can.

---

## 5. The new Review Workspace

The most important surface. It gets three modes, and it opens in the one that respects the
auditor's time.

### Mode 1 — Triage (the entry point)

No tables, no tiles. One page, two groups, in the auditor's language.

```
        Revenue documentation
        14 sections · 41 statements · drawn from 6 sources


        10 sections are clean
        Every statement traced to a source. Nothing contradictory.
        [ Accept all 10 ]     Read them first →


        4 need your judgement
        ──────────────────────────────────────────────────
        Credit management        Two sources disagree about who can
                                 change a credit limit
        Credit notes             A statement no source supports
        Cash receipt             A statement no source supports
        Monitoring               A statement no source supports

        [ Start with these ]
```

This single screen delivers the product's core promise before the auditor clicks anything:
*the routine has been absorbed; here is where you are needed.* The bulk approval that was
buried behind a button in v1 is now the primary path — and it is still safe, because the
ten are ten precisely by the rules that made the four exceptions.

### Mode 2 — Focus (one judgement at a time)

Full width. One item. No sidebars, no tabs, no chrome but a counter.

```
                                                              2 of 4

  Credit notes, returns and rebates

  ┄┄ Credit notes are raised by sales administration and approved
     by the sales manager. A credit note must reference the
     original invoice.                                    ← context, dimmed

  ▍  Credit notes above EUR 5,000 additionally require the
  ▍  approval of the financial controller.                ← the item, full ink

     No source supports this
     Searched 38 transcript segments, 12 answers, 134 document chunks.
     The model generalised from the other value thresholds in the process.

     ┌ What the evidence actually supports ─────────────────────┐
     │ Credit notes are raised by sales administration and      │
     │ approved by the sales manager. No value threshold        │
     │ requiring finance approval was identified.               │
     └──────────────────────────────────────────────────────────┘

     [ Use this ⏎ ]   [ Write my own  E ]   [ Ask the client  A ]   [ Reject  R ]
```

Everything about this is a rejection of v1's modal drawer: the statement stays in its
paragraph context, the problem is stated in one sentence rather than a warning box, the
recommended action is pre-written and one keystroke away, and there is no scrim, no
"Cancel", no returning to a table.

For a contradiction the same frame holds two source cards side by side, with the three
resolutions as the same one-key choices.

### Mode 3 — Read (the document, finally)

Once judgements are made, or whenever the auditor asks for it: the working paper, full
width, centred, 18px serif, 68-character measure, generous leading. It should be pleasant to
read — because a reviewer who enjoys reading the file catches more than one who endures it.

**Evidence opens inline.** Click a sentence and the paragraph parts; the quote appears
directly beneath it with speaker and timestamp, then closes when you move on. The eye never
leaves the line it was reading. This replaces the 358px permanent panel and gives the
document the whole workspace.

No section navigator list. A thin **attention rail** in the left margin: one tick per
section, coloured by state, labelled only where something needs attention. A minimap, not a
menu.

Approval appears at the end of each section as you reach it, and `A` approves without
touching the mouse.

---

## 6. The new Coverage concept

The auditor's question is four words: *what don't we know?* v1 answered it with 45 rows,
113 chips and snake_case keys. The new default answers it in a sentence and a short list.

```
        Revenue understanding
        84%   ·   37 of 44 areas established


        Needs clarification (3)
        ──────────────────────────────────────────────────────────
        Credit management     Two sources disagree about who can
                              change a customer's credit limit
        Cut-off               We don't know how goods in transit and
                              consignment stock are treated at period end
        Invoicing             Nobody could say who reviews the price
                              override report        ⚑ required area

        Understood (9)
        Customer & contract · Order entry · Delivery · Invoicing ·
        Revenue recognition · Credit notes · Cash receipt · Manual
        journals · Monitoring                              show detail →

        Not applicable (1)
        Returns — machines are not returnable and spare-part returns
        are immaterial                                    reason on file
```

Plain English. No ids, no fact keys, no percentages per sub-process. Progressive disclosure
is one control: **"Show methodology"** reveals the coverage item ids, the must-know fact
keys, the deterministic trigger that produced each question, and the ISA reference. The
engine stays complex; the surface stops apologising for it.

Every gap carries its action inline — *Ask the client · Record what I know · Not applicable*
— and resolving one updates the percentage and the stage spine immediately, in place.

---

## 7. The new Controls review concept

v1: fourteen table rows, each with a `[Key] [Not key]` pair. This is the same interaction
fourteen times, in a cramped cell, with the reasoning hidden in a panel below the fold. It
guarantees that decision fourteen gets less thought than decision one.

New: a **recommendation queue**, one card at a time, full width, keyboard-first.

```
                                                              3 of 7

  Orders exceeding the credit limit are blocked and released
  only by credit control

  Business Central blocks an order where the customer's exposure would
  exceed the approved credit limit. Credit control releases the block
  and the release is recorded in a log.

  Why this may be key
  It addresses the credit risk at the point of order acceptance, it is a
  configured threshold rather than a judgement, and every release leaves
  a system record.

  Addresses    Credit limits raised outside credit control  R-07
  Supported by 3 sources                                         expand →

  ⚠ One thing is unresolved
  The owner's authority cannot be confirmed while the contradiction about
  who may change a limit is open.

  Suggested        Key control

  [ Accept ⏎ ]   [ Not key  N ]   [ Undecided  U ]   [ Edit  E ]        Skip →
```

Reasoning in prose by default; the six-criterion table is one click behind *Show criteria* —
it is excellent, and it is methodology, so it belongs in the methodology layer.

Risks use the identical pattern. One learned interaction, two surfaces. A senior can clear
seven recommendations in under a minute with `⏎ ⏎ N ⏎ U ⏎ ⏎ ⏎` and never touch the mouse —
while each decision has been presented with more context than v1's table row ever gave.

---

## 8. Navigation concept

**Three mechanisms, no menus.**

1. **The stage spine** — four states, always visible, each with what it owes. Moves you
   between stages.
2. **⌘K command palette** — everything else. Fuzzy search across sections, risks, controls,
   coverage items, sources, engagements, and actions. Opens on `⌘K` / `Ctrl K` or `/`.
3. **Contextual links** — a risk names its control; the control is one click away. Clicking
   an open item goes to the statement it blocks. Navigation is a consequence of content.

**Keyboard model**, consistent everywhere:

| Key | Everywhere |
|---|---|
| `⌘K` `/` | Command palette |
| `J` `K` | Next / previous item |
| `⏎` | Accept the suggested action |
| `E` | Edit |
| `A` | Approve / ask |
| `R` | Reject |
| `U` | Toggle unresolved-only |
| `?` | Shortcut sheet |
| `⌘Z` | Undo the last decision |
| `Esc` | Back out one level |

**Undo, not confirmation.** v1 used a confirmation dialog before bulk approval. Confirmation
dialogs are how 2012 software protected users; undo is how modern software does it. Every
decision is reversible for as long as the session lasts, announced in a quiet line —
*10 sections approved · Undo ⌘Z* — and no routine action asks "are you sure?" again.

The one exception: the sign-off itself. That is the one place a deliberate stop is correct.

---

## 9. Visual design direction

An original audit-native system. Not Caseware, not a consumer app.

**Typography does the work that borders did in v1.**

| Role | v1 | v2 |
|---|---|---|
| Body / UI | 13px | **15px** |
| Document | 15px serif | **18px serif, 1.75 leading, 68ch measure** |
| Page title | 23px | **30px, tight tracking** |
| Meta | 11px | 12px, used sparingly |

**Colour is nearly absent.** Warm paper ground (`#FCFCFA`), white content, ink `#15181C`.
One accent — deep ink-blue `#1B3A5C` — for interactive affordance only. Three attention
colours, used as a 3px left rule or a 5px dot, never as a filled badge: amber (needs
support), clay red (contradiction), green (settled). A screen with nothing wrong on it is
entirely black, white and warm grey. Colour therefore *means* something.

**Structure by whitespace and hairlines.** Panel headers, card borders, table rules and
metric tiles are gone. Lists are rows of text separated by 1px `#EFEFEA` hairlines and 20px
of air. Density comes from tight, well-set type — not from compressing everything into
boxes.

**Motion: two transitions total.** Inline evidence expanding (140ms) and the focus-mode item
change (120ms). Both are functional — they say "this came from here". Nothing else moves.

**Numbers are typographic, not decorative.** `84%` set at 30px in the page title line beats a
bordered tile with a caption, and takes a tenth of the space.

---

## 10. Components that disappear entirely

| Killed | Replaced by |
|---|---|
| Permanent dark sidebar rail | Nothing. ⌘K and the stage spine |
| Ten-tab workspace bar | Four-stage spine with live counts |
| Breadcrumb trail | One identity line; ⌘K to move |
| `.metrics` tiles (32 of them) | One typographic number in the page title |
| `panel()` with header + border (45) | Whitespace, hairlines and a heading |
| Data tables for decisions (20) | Focus queue, one item at a time |
| Permanent 358px source panel | Inline evidence beneath the clicked claim |
| Section navigator list | Attention rail in the left margin |
| Modal drawer + scrim for routine actions | Full-width focus mode; inline expansion |
| Bulk-approve confirmation dialog | Do it, then `Undo ⌘Z` |
| `AI draft` / `AI: likely key` / `AI proposes` | `Draft` / `Suggested` / `Needs support` |
| `status()` bordered pills everywhere | 5px dot + weight, or a left rule |
| Separate Matrix / Export / Settings destinations | A ⌘K view, the end of Complete, a ⌘K action |
| Coverage fact-chip wall by default | Plain-language gaps; ids behind *Show methodology* |
| Six-criterion table always visible | Prose reasoning; criteria behind *Show criteria* |

**What is explicitly kept**, because it is the product: block-level provenance with
section-level approval, the needs-source hard gate, the contradiction blocking downstream
objects, fact-level coverage underneath, the six key-control criteria, the seven sign-off
gates, the deterministic-trigger origin of follow-ups, and "not obtained" as first-class
approvable output — still styled as the opposite of "needs support".

---

## Success test

Put a 24-year-old assistant in front of it with no training and one instruction: *"finish the
Revenue review."*

They should, without asking anything:

1. see that four things need them and ten do not;
2. clear the four with the keyboard;
3. click a sentence and understand instantly where it came from;
4. accept seven control recommendations in under a minute;
5. find the one thing blocking sign-off;
6. and say afterwards — *"I could work faster in this than in our current audit software,
   and nobody had to teach me."*

If they reach for a manual, the direction has failed.
