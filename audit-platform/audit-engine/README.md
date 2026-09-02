# Revenue Audit Intelligence Engine — Phase 0

The headless engine described in [`../07-phase-0-execution-plan.md`](../07-phase-0-execution-plan.md).
No web application, no database, no authentication, no cloud: a corpus case goes in, a
working paper and a run manifest come out.

```bash
pnpm install
pnpm test                                              # 30 unit tests, no API key needed
pnpm engine pack                                       # validate the methodology pack
pnpm engine run corpus/synthetic/case-01 --mock        # plumbing only, no model call
ANTHROPIC_API_KEY=... pnpm engine run corpus/synthetic/case-01
ANTHROPIC_API_KEY=... pnpm engine eval --set dev       # score against the answer keys
```

## Layout

| Package | Contains |
|---|---|
| `packages/domain` | Every schema. One definition serves types, runtime validation and the model's structured output. Depends on nothing |
| `packages/methodology` | The Revenue pack (YAML, SME-reviewable) plus its loader and consistency validator |
| `packages/engine` | The ten-function engine surface, prompts, the deterministic coverage engine and grounding validator |
| `packages/evals` | Corpus loader, M6 metrics, and the M4 edit taxonomy |
| `apps/cli` | `pack`, `run`, `eval` |
| `corpus/synthetic` | Class C0 cases, committed. `corpus/real/` (C1) is gitignored and never committed |

## What is deliberately deterministic

`evaluateCoverage`, `identifyMissingFacts`, `validateGrounding` and `assembleOutputs` never
call a model. They are the components an auditor or a security reviewer reads first, and the
ones where a silent bug would be invisible in the output. They are unit-tested accordingly —
including the case where an object carries no evidence at all.

Running with `--mock` on a case with no extracted facts still produces **all ten mandatory
follow-up questions**, because mandatory audit questions come from the pack, not from model
initiative. That behaviour is the point of the coverage engine.

## The one unverified integration point

`packages/engine/src/llm.ts` calls `client.messages.parse` with
`output_config.format = zodOutputFormat(schema)`. That is the only place a live API call is
needed to confirm the wiring; everything else is exercised by the mock client and the unit
tests. The workspace is pinned to zod v4 because the SDK helper requires it.

## Data classification

`corpus/synthetic/` is class **C0**. Class **C1** (anonymised historical) goes in
`corpus/real/`, which is gitignored, and only after the data-sharing agreement or the firm's
anonymisation protocol is in place. Class **C3** (audit-client confidential) never touches
this package — see `../07-phase-0-execution-plan.md` §7.2.
