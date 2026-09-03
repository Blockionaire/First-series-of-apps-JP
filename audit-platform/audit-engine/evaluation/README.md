# Running the Phase 0 evaluation

Nothing here needs a service. Four files and one CLI command.

## 1. Prepare the blind test

```bash
cp evaluation/blind-test-config.example.json evaluation/blind-test-config.json   # fill in
node apps/cli/src/index.ts blind --config evaluation/blind-test-config.json
```

Writes `out/blind/assignments.json` and one empty `scoring-<rater>.csv` per rater.
**Never send `assignments.json` to a rater** — it is the de-blinding key.

Then, per case, produce three documents rendered through the *same* neutral template:

- **A** the firm's original working paper, re-rendered — never their own file as-is;
- **B** the raw engine output;
- **C** B after an auditor's review pass.

Name the files by label, not by variant: `real-01-document-1.html` and so on, using the
mapping in `assignments.json` for that rater.

## 2. Produce variant C, and measure M3 and M4 at the same time

Open B in Word, turn on tracked changes, make it file-ready in one pass, time-boxed to 90
minutes. The editor is **not** one of the raters.

- Record the elapsed minutes → `evaluation/timings.json`.
- Log each change → `evaluation/edits.csv` (`caseId, location, category, severity, note`).
  Categories and severities are defined in `07 §7.8` M4; roughly 15 minutes of logging per case.

## 3. Collect ratings

Each rater fills their `scoring-<rater>.csv`: rank all three documents (1 = would rather
start from this), score each 1–7 on completeness, audit relevance, clarity, conciseness and
traceability, and give review effort in minutes.

Ask the blinding question **once, last**, into `evaluation/blinding-guesses.csv`
(`raterId, caseId, guessedAiLabels` — labels separated by spaces or semicolons).

Concatenate the returned sheets into `evaluation/ratings.csv`.

## 4. Report

```bash
node apps/cli/src/index.ts report --set test
```

Prints M1–M6 against their separate thresholds, the criterion profile per variant, hard
fails, and the verdict. It reports **incomplete** until the ratings, edits and timings exist —
by design, because the automatic metrics alone never decide the gate.

## What the numbers are and are not

`engine eval` on the synthetic corpus measures **progress**. It is not evidence of product
quality: those cases were authored to exercise the engine, and the case and its answer key
share an author. The evidence gates are SME-reviewed cases, real paired cases with the firm's
own working paper, and the blind human evaluation.
