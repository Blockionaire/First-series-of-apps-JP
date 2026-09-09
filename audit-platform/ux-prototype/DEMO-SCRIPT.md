# Design Partner Demo — ten beats, 8–12 minutes

The in-app version runs from the Work screen (*start the guided demo*) or `⌘K → Guided demo`.
`→` and `←` move between beats, `Esc` exits.

**Before you start:** open the prototype and press `⌘K → Reset the prototype`. Say once that the
client is fictional and nothing leaves the browser, then stop talking about the prototype.

**The framing, in one line:** *"This is where an auditor would do the interim work on a process —
not a tool that writes the documentation, the place the work happens."*

**If you only have three minutes,** do beats 4, 7 and 8. The line walkthrough is the product.

---

## Beat 1 — Interim sits inside an engagement · `#/engagement`

**Say:** "Client, financial year, the four phases, and six processes inside interim. Revenue is
one process among several. This is not a Revenue application — it is where process-level interim
work happens, and Revenue is what we have built the methodology for."

---

## Beat 2 — Seven steps, and a map · `#/revenue`

**Show:** the process home. Let them look before you speak.

**Say:** "This is the whole interim workflow for one process: prepare, walk through, document,
controls and findings, line walkthrough, control testing, complete. Not tabs — a journey. Each
step says what it still owes you, and the ones that haven't started say why.

And this is the process as we understand it. It fills in with controls and findings as the work
goes, and at step five we test it against a real transaction."

---

## Beat 3 — What we still don't know · `#/walkthrough`

**Say:** "Step two. Three things need clarification, in plain English. No IDs, no fact keys."

**Then open *Show methodology*.** "And underneath: 45 coverage items from your pack, the
must-know facts, which are mandatory under ISA 240, and the rule that generated each follow-up.
The engine is as complex as your methodology. The screen isn't."

---

## Beat 4 — The routine, separated from the judgement · `#/understanding`

**Show:** run the pipeline, wait for the validation stage.

**Say:** "Nine stages; two of them are ordinary code. That one is validation — every statement has
to cite a source and the quote has to occur in it. Three didn't."

**Then Review the draft.** "Four statements need a person. Ten sections are clean and go in one
action. That is the whole promise, and it happens before anything is asked of you."

**Press Enter four times.** The contradiction first, then the three unsupported claims.

---

## Beat 5 — Where did this sentence come from? · read mode

**Say:** "Click any sentence and the evidence opens beneath it — speaker, timestamp, exact words.
In a file review that question takes twenty minutes of scrolling. Here it is two seconds."

---

## Beat 6 — Controls on the process · `#/controls`

**Say:** "Step four. Same map, now annotated: which step each control sits on, and which steps
have something wrong with them. Look at despatch and at installation — no control identified.

Fourteen controls as a queue, not a table. Enter accepts, N marks it not key."

**Point at the risks section.** "And these are *not* concluded here. Assessing risks of material
misstatement is risk analysis — that comes after the interim work. They are carried forward."

---

## Beat 7 — Now test the model against reality · `#/trace`

**Say:** "Step five, and this is the one that changes what the product is. Everything so far is
what people told us. A line walkthrough takes one real transaction and traces it end to end
through the process we just documented."

**Pick SO-24188.** "Expected step, expected control, expected evidence — against what actually
happened. Press Enter to corroborate."

---

## Beat 8 — The walkthrough finds the model wrong · step 5 of the trace

**Let them read it.** Then:

**Say:** "The invoice went out on 15 September. The customer signed acceptance on 22 September.
The entity's own policy recognises machine revenue on acceptance — so revenue was recognised
seven days before the performance obligation was satisfied.

Nobody said that in the interview. It came from comparing two dates on one order. And it isn't a
one-off: the invoicing batch triggers on despatch, not on acceptance, so it happens on every
machine sale where installation lags delivery."

**Finish the trace and conclude it.** "Seven steps, six corroborated, one exception — and the
exception becomes a finding, back in step four, on the invoicing node of the map."

**This is the beat that sells the product.** Do not rush it.

---

## Beat 9 — Identifying a control is not testing it · `#/testing`

**Say:** "Step six, clearly marked as a future concept. Control, test setup, population and
selection, evidence, results, conclusion. The sample size always shows the firm parameter that
produced it — never a number the model chose. One exception in five, and the platform stops:
whether that means the control can be relied on is your judgement."

---

## Beat 10 — Complete closes the process, not the audit · `#/complete`

**Say:** "Ten conditions, each linking to the step that clears it. Then what interim hands
forward: the process understanding, the matrix, the findings, the walkthrough result.

Risk analysis is the next phase and deliberately not in this product. The platform never signs
anything, and that isn't a limitation we're apologising for — it's the product."

---

## Optional · `#/cockpit`

Only if it has gone well. "Clearly labelled as a concept — no audio, no speech recognition, no
live model. But this is where it goes: the follow-up question while the person is still in the
room. Everything you've seen happens after the meeting."

**Be explicit that it is not built.**

---

## Questions you will get

**"Where does this stop?"**
At the end of the process-level interim work. Client acceptance, entity understanding and
inherent risk factors come before; risk analysis and the final audit come after. We are not
pretending to do those.

**"Why isn't risk assessment in here?"**
Because it happens after the process work, with the process understanding as its input. We
identify risks and hand them forward with the matrix. Concluding on them in the middle of a
walkthrough would be the wrong order.

**"Does client data go to a model vendor?"**
Nothing leaves the browser in this prototype. In the product, data classification and
EU-resident inference are in `04-security-privacy-compliance.md`.

**"Whose methodology is it?"**
Yours. Versioned YAML, pinned per engagement so a pack update never changes an approved file.
That is what *Show methodology* is showing you.

**"What if the AI is wrong?"**
It is, regularly — you saw three unsupported statements in one process. The design assumes it
will be wrong, so the question is whether being wrong is visible and cheap.

**"Will my seniors use it?"**
That's the one we care about. Built for someone with no training: ⌘K, keyboard decisions, undo
instead of confirmation dialogs. Put your newest joiner in front of it and watch.

**"Can I have it?"**
Not yet. What we want is an hour with a senior who does these walkthroughs, and one anonymised
prior-year Revenue working paper.
