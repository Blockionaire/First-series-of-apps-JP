# Design Partner Demo — nine beats, 5–10 minutes

The in-app version of this path runs from the left rail: **Design partner demo**. It sets each
screen up for you and puts the line to say in a bar at the bottom. `→` and `←` move between
beats; `Esc` exits. This document is the same path, with the presenter's notes.

**Before you start:** open `index.html`, click **Reset demo** in the top right, and check you are
on the dashboard. The whole prototype runs locally with fictional data — say so once, at the
start, and then stop talking about it.

**The one-line framing:** *"This is what a Revenue walkthrough could look like if the write-up
were a review task instead of an authoring task. Everything you see is fictional."*

---

## Beat 1 — The auditor's morning · `#/`

**Show:** the *Needs your attention* list.

**Say:** "This is not a dashboard of metrics. Every line is something waiting on a person. Two of
them are things the system is deliberately refusing to finish — we'll come back to those."

**Do not** explore the other engagements. Move on.

---

## Beat 2 — One process, measured · `#/revenue`

**Show:** the metric strip and the coverage bars by sub-process.

**Say:** "Revenue is the only process in scope. Its state is a number, not a feeling: how much of
the process we understand, how many facts we've established, how many questions are open, how
many statements can't be supported."

**If asked what 84% means:** "37 of 44 applicable coverage items. One item is marked not
applicable with a reason that's written into the file. It measures how complete our
*understanding* is against the firm's methodology — not how complete the audit is."

---

## Beat 3 — What we still do not know · `#/coverage`

**Show:** expand **R5 — Invoicing**. Point at item **R5.3**, and at the fact chips under it.

**Say:** "Forty-five coverage items from the firm's own methodology pack. Under each one are the
facts we have to establish. Here's the invoicing item — it's a mandatory item, and it's only
partially covered, because one fact is missing: *who reviews the price override report*. The
client told us the report exists. Nobody could tell us who reads it."

**The point to land:** the system knows what it doesn't know, at the level of a named fact, not a
vague sense of incompleteness.

---

## Beat 4 — The follow-up nobody would have written down · `#/open-items`

**Show:** `OI-02` (the override reviewer question) and `OI-01` (the contradiction).

**Say:** "That missing fact turned into a question automatically — and look at the label: it came
from a deterministic rule in the methodology pack, `R5.3.T2`, not from the model's initiative.
The firm can read the rule.

And above it, something the model *did* find on its own: the controller told us only credit
control can change a credit limit. The commercial director, in a questionnaire, said he can raise
one himself by up to fifty thousand euro. Nobody in that engagement had both answers in front of
them. The system did."

**This is usually where the room goes quiet.** Let it.

---

## Beat 5 — Nine stages, not one prompt · `#/generate`

**Show:** run the pipeline and let it play. It takes about eighteen seconds.

**Say:** "Facts first, then narrative, then risks, then controls, then the six key-control
criteria. Two of the nine stages are ordinary code, not a model — including stage 8."

**Wait for stage 8**, then: "Validation. Every generated statement has to cite a source, and the
quoted text has to actually occur in that source. Thirty-eight of forty-one passed. Three did
not."

---

## Beat 6 — Where did this sentence come from? · `#/review`

**Show:** section **8, Invoicing**. Hover a source chip, then click it.

**Say:** "This is where the auditor spends their time, so it's where the product is won or lost.
Every claim carries a source. Hover for the quote. Click, and the exact passage is pinned on the
right, with the speaker and the timestamp.

In a file review, the question is always *where does this sentence come from?* Today that takes a
senior twenty minutes and a lot of scrolling. Here it takes two seconds."

**Point out** the section has fourteen statements and one decision. "Approval is per section, not
per sentence. Ninety approval clicks would just replace writing with clicking."

---

## Beat 7 — The system stops itself · `#/review`, section 10

**Show:** the amber statement — *"Credit notes above EUR 5,000 additionally require the approval
of the financial controller."*

**Say:** "Read that sentence. It's plausible, it's well written, it's in the right register — and
it is entirely invented. No source in this engagement says anything about a five thousand euro
threshold. It's marked *Needs source*, and look at the section header: the approve button is
disabled. Not a warning. A stop."

**Click Resolve.** "And the platform will tell you why it produced it: it generalised from the
other value thresholds in the process, and from the commercial director saying he'd 'expect
finance to look at' the larger ones. It searched thirty-eight transcript segments, twelve
questionnaire answers and a hundred and thirty-four document chunks, and found nothing."

**Click *Replace with what the evidence supports*.** The section unblocks.

**The line that matters:** "That is the difference between this and a chatbot. A chatbot would
have given you that sentence and let you sign it."

---

## Beat 8 — AI proposes, the auditor decides · `#/risks`

**Show:** the risk table, then click into `R-01`.

**Say:** "Eleven risks, mapped to the firm's own library at assertion level. One of them isn't in
the library at all — the model had to justify why it created a new one, and you can read the
justification.

Two columns matter here: *AI proposes* and *Auditor decision*. They're deliberately different
fields with different styling, because only one of them goes in the file as a conclusion."

**Scroll to `R-07`.** "And this one can't be concluded at all — it's blocked by the contradiction
we saw earlier. The system won't guess, and it won't quietly drop it."

**If you have time, go to `#/controls` and click `C-10`.** Show the six key-control criteria with
two marked *unknown*: "It won't tell you this is a key control, because it can't establish two of
the six criteria. It generates the follow-up question instead of a lower-confidence answer."

---

## Beat 9 — Nothing is signed by the machine · `#/signoff`

**Show:** the seven readiness gates.

**Say:** "Seven conditions. An unsupported statement, an unresolved contradiction, or an open
mandatory ISA 240 item each block sign-off on their own. The file records who prepared, who
reviewed, and that AI assistance was used with the pack and model versions.

The platform never signs anything. That is not a limitation we're apologising for — it's the
product."

**Close on:** "The claim isn't that this writes your working paper. It's that reviewing this is
faster than writing it from scratch, and that it finds the things you'd otherwise find three days
later, or not at all."

---

## Optional tenth beat — the future · `#/cockpit`

Only if the conversation has gone well and there is time.

**Say:** "This one is clearly labelled as a future concept — there's no audio, no speech
recognition and no live model here, and it's some way down the roadmap. But this is where it
goes: the transcript on the left, coverage filling in live in the middle, and the follow-up
question on the right *while the person is still in the room*.

Everything you've seen up to now happens after the meeting. This is the version where the
question that surfaces during write-up surfaces during the walkthrough instead."

**Be explicit that it is not built.** Design partners forgive a roadmap. They do not forgive a
demo that implied a capability.

---

## Questions you will get, and short answers

**"Does the client data go to a model vendor?"**
In this prototype nothing leaves the browser. In the product, the architecture and data
classification are in `04-security-privacy-compliance.md`, and EU-resident inference is on the
path before any client data class is processed.

**"Whose methodology is it?"**
Yours. The pack is versioned YAML — sub-processes, coverage items, risk and control libraries,
sample-size tables. It is configuration, not code, and it is pinned per engagement so a pack
update never changes an approved file.

**"What if the AI is wrong?"**
It is, regularly — you saw one case. The design assumption is that it will be wrong, so the
question is whether being wrong is visible and cheap. Grounding validation, the needs-source
gate, and the fact that nothing enters the file unapproved are all answers to that question.

**"How much time does it actually save?"**
We don't know yet, and we'd rather not guess at you. Today a Revenue process costs four to eight
hours of senior time. The measurement we care about is whether an auditor prefers reviewing this
output to writing it themselves — that experiment is running separately from this prototype.

**"Can I have it?"**
Not yet. What we want from you is an hour with a senior who does these walkthroughs, and access
to one anonymised prior-year Revenue working paper.
