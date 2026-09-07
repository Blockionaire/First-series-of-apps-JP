# Design Partner Demo — nine beats, 5–10 minutes

The in-app version runs from the Work screen (*start the guided demo*) or `⌘K → Guided demo`. It
sets each screen up and puts the line to say at the bottom. `→` and `←` move between beats,
`Esc` exits. This document is the same path with the presenter's notes.

**Before you start:** open `index.html` and press `⌘K → Reset the prototype`. Say once that the
client is fictional and nothing leaves the browser, then stop talking about the prototype.

**The framing, in one line:** *"This is what a Revenue walkthrough could look like if the
write-up were a review task instead of an authoring task."*

**If you only have two minutes,** do beats 4, 5 and 6. They are the product.

---

## Beat 1 — One question, not a dashboard · `#/`

**Show:** the whole screen. Let them look at it for three seconds before you say anything.

**Say:** "No sidebar. No tabs. No metric tiles. It opens by telling you the single most useful
thing to do next, and what else is waiting. Everything else is behind ⌘K."

**Press ⌘K** and type three letters. "That's the navigation. Sections, risks, controls, coverage
areas, sources, other engagements — and commands."

---

## Beat 2 — What we still don't know · `#/understand`

**Show:** the three gaps, in plain English, each with its actions on the row.

**Say:** "Everything the walkthrough established, and the three things it didn't. Notice there
are no IDs, no fact keys and no percentages per sub-process — just what we still don't know and
what to do about it. Resolving any of these updates the number at the top immediately."

**Then open *Show methodology*.** "And underneath: the 45 coverage items from your own pack, the
must-know facts, which are mandatory under ISA 240, and the deterministic rule that produced each
follow-up question. The engine is as complex as your methodology. The screen isn't."

**This is the beat that satisfies a methodology partner.** Give it time if one is in the room.

---

## Beat 3 — Nine stages, not one prompt · `#/review`

**Show:** press Start and let it run. About eighteen seconds.

**Say:** "Facts first, then narrative, then risks, then controls, then the six key-control
criteria. Two of the nine stages are ordinary code rather than a model."

**Wait for the validation stage.** "That one is code. Every statement has to cite a source, and
the quoted text has to actually occur in that source. Thirty-eight passed. Three did not."

---

## Beat 4 — The routine, separated from the judgement · `#/review`

**Show:** the triage screen. Say nothing for a moment.

**Say:** "This is the whole product on one screen, and it happens before anything is asked of
you. Four things need a person. Ten sections are clean — every statement traced, nothing
contradictory, nothing edited — and you can accept all ten in one action.

That is the promise: the machine does the routine work and sorts it from the judgement. It
doesn't ask you to review two hundred paragraphs with equal attention."

---

## Beat 5 — One judgement at a time · `#/review` → Start

**Show:** the contradiction, which the queue puts first.

**Say:** "The controller told us only credit control can change a credit limit. The commercial
director, in a questionnaire, said he can raise one himself by up to fifty thousand euro. Nobody
in that engagement had both answers in front of them.

Three ways out, and they're all one keypress." **Press 2.**

**Then the unsupported claim.** "Read this sentence. It's plausible, well written, and entirely
invented — no source says anything about a five thousand euro threshold. The platform will tell
you why it produced it, and the correction is already written."

**Press Enter three times.** "Four judgements, four keystrokes, no mouse."

**The line that matters:** "A chatbot would have given you that sentence and let you sign it."

---

## Beat 6 — Where did this sentence come from? · Read the working paper

**Show:** click any sentence.

**Say:** "The evidence opens directly beneath the line you're reading — speaker, timestamp, exact
words. No side panel, no navigation, no losing your place.

In a file review the question is always *where does this come from?* Today that's twenty minutes
of scrolling. Here it's about two seconds."

**Point at the left margin.** "And that's the only navigation the document has: a tick per
section, coloured where something needs attention."

---

## Beat 7 — Seven decisions in under a minute · Review recommendations

**Show:** the control queue.

**Say:** "Fourteen controls. Not a table of fourteen rows with a pair of buttons in each — one at
a time, with the reasoning in prose, and the six key-control criteria one click away if you want
them. Enter accepts the suggestion, N marks it not key."

**Clear five or six with the keyboard.** Then find `C-10`, the monthly management review:
"This one it refuses to recommend either way, because two of the six criteria can't be
established. It generates the follow-up question instead of a lower-confidence answer."

**Press ⌘Z.** "And every decision is reversible. Nothing in this product asks 'are you sure?'
except the sign-off."

---

## Beat 8 — What is holding things up · `#/resolve`

**Show:** the list, ordered by what each item blocks.

**Say:** "Not sorted by type — sorted by consequence. The contradiction at the top is stopping a
statement, a control and a risk at once. And each one says where it came from: a deterministic
rule in your methodology, or something the model noticed across two sources."

---

## Beat 9 — Nothing is signed by the machine · `#/complete`

**Show:** the seven conditions.

**Say:** "Seven conditions, each linking to the work that clears it. An unsupported statement, an
unresolved contradiction or an open mandatory item each block sign-off on their own.

The file records who prepared, who reviewed, and that AI assistance was used with the pack and
model versions. The platform never signs anything — and that isn't a limitation we're
apologising for. It's the product."

**Close on:** "The claim isn't that this writes your working paper. It's that reviewing this
beats writing it, and that it catches the things you'd otherwise find three days later, or not
at all."

---

## Optional tenth beat — the future · `#/cockpit`

Only if the conversation has gone well.

**Say:** "Clearly labelled as a concept — no audio, no speech recognition, no live model, and
some way down the roadmap. But this is where it goes: transcript on the left, understanding
filling in live in the middle, and the follow-up question on the right *while the person is
still in the room*. Everything you've seen so far happens after the meeting."

**Be explicit that it is not built.** Design partners forgive a roadmap; they do not forgive a
demo that implied a capability.

---

## Questions you will get

**"Does client data go to a model vendor?"**
Nothing leaves the browser in this prototype. In the product, data classification and EU-resident
inference are in `04-security-privacy-compliance.md`, and EU inference is on the path before any
client data is processed.

**"Whose methodology is it?"**
Yours. Versioned YAML — sub-processes, coverage items, risk and control libraries, sample-size
tables. Configuration, not code, pinned per engagement so a pack update never changes an approved
file. That's what *Show methodology* is showing you.

**"What if the AI is wrong?"**
It is, regularly — you saw three cases in one process. The design assumes it will be wrong, so
the question is whether being wrong is visible and cheap. Validation in code, the needs-support
gate, and nothing entering the file unapproved are all answers to that.

**"Will my seniors actually use it?"**
That's the one we care most about. It's built for a 24-year-old who has never been trained on it:
⌘K, keyboard decisions, undo instead of confirmation dialogs, and no form longer than one field.
Put your newest joiner in front of it and watch — that's the test that matters.

**"How much time does it save?"**
We don't know yet and would rather not guess at you. Today a Revenue process costs four to eight
hours of senior time. What we're measuring is whether an auditor prefers reviewing this output to
writing it themselves; that experiment runs separately from this prototype.

**"Can I have it?"**
Not yet. What we want is an hour with a senior who does these walkthroughs, and one anonymised
prior-year Revenue working paper.
