# 8. Tooling and Development Stack — frozen for Phase 0

**Purpose.** Freeze the minimum toolchain needed to execute Phase 0. Not a technology
survey, not a target architecture. Every entry answers nine questions; anything that cannot
justify itself is deferred or removed.

**The rule.** *Every additional tool or SaaS dependency must justify its existence.* Phase 0
has one job — answer whether auditors prefer reviewing the engine's output to writing the
paper themselves — and a tool that does not serve that is cost, not capability.

**One AI coding environment.** Claude Code is the implementation environment. No second
AI coding tool is adopted unless a concrete capability is missing; two overlapping assistants
cost money, split context and produce inconsistent code.

Columns used throughout: **Free/Paid · Phase 0–3 cost · Alternative · Switch cost · Lock-in ·
Decide now?**

---

## A. Founder development tools

| Tool | Purpose | Required in | Free/Paid | Phase 0–3 cost | Alternative | Switch | Lock-in | Decide now |
|---|---|---|---|---|---|---|---|---|
| **Claude Code** | The implementation environment: writes, edits and reviews the code, drafts the methodology pack and corpus with the SME | **P0**, and every phase after | Paid subscription — **already held: Claude Pro at $20/mo** | **$20/mo on Pro ≈ $180 over 9 months.** Budget $100–200/mo only if Pro's usage limits start throttling long sessions | Cursor, Copilot, Codex CLI | Low | No — it produces ordinary source in your repo | **Already in place** |
| **Anthropic Console + API key** | Model access for the engine itself | **P0, at the API gate — see §G** | Pay-as-you-go, **billed separately from the Claude Pro subscription** | Model spend, see §B | — | Low | No | **Not yet** |
| **VS Code** | Editor, terminal, diff review, Claude Code extension | **P0** | Free | €0 | JetBrains, Zed, Neovim | Low | No | **Yes** (trivial) |
| **Node 22 LTS + pnpm** | Runtime and package manager | **P0** | Free | €0 | Bun, npm | Low | No | **Yes** |
| **Git + GitHub (private repo)** | Version control, history, later CI and PR review | **P0** | Free tier is sufficient | €0 | GitLab, Codeberg | Low — git history is portable | No | **Yes** |
| **Full-disk encryption + password manager** | Required by the Phase 0 data-handling rules (`07 §7.2`) before any C1 corpus material arrives | **P0** | Free (FileVault/BitLocker + OS keychain) or ~€3/mo | €0–36/yr | 1Password, Bitwarden | Low | No | **Yes** |
| **Domain name** | Needed for a professional address when approaching design partners; nothing else in P0 | P0 (soft) | Paid | €10–15/yr | — | Low | No | Optional |
| **Decision log** | One markdown file in the repo recording why each choice was made | **P0** | Free | €0 | Notion, Linear | Low | No | **Yes** — a file, not a SaaS |

**Explicitly not adopted in Phase 0:** a second AI coding assistant; an agent framework;
project-management SaaS (GitHub Issues is enough for one person); Notion/Linear/Slack;
design tools (nothing is designed until Phase 1); analytics; a CRM.

---

## B. Phase 0 runtime and product dependencies

Everything the engine actually depends on. The whole runtime is **four production
dependencies and three development ones.**

| Dependency | Purpose | Required in | Free/Paid | Phase 0–3 cost | Alternative | Switch | Lock-in | Decide now |
|---|---|---|---|---|---|---|---|---|
| **TypeScript** | Types are the contract between stages; the schemas are the specification | **P0** | Free | €0 | Plain JS + JSDoc | High (it is the codebase) | No | **Yes** |
| **Node 22 native TS execution** | Runs the CLI and engine directly — no build step, no transpiler | **P0** | Free | €0 | tsx, ts-node, a bundler | Low | No | **Yes** |
| **zod v4** | One definition serving TypeScript types, runtime validation and the model's structured-output schema | **P0** | Free | €0 | Valibot, ArkType, hand-written JSON Schema | Medium — schema syntax is pervasive, but per-file | No | **Yes** |
| **`yaml`** | The methodology pack is authored and reviewed by an auditor; YAML supports comments, JSON does not | **P0** | Free | €0 | JSON (loses reviewability), TOML | Low | No | **Yes** |
| **`@anthropic-ai/sdk`** | Model calls, structured outputs, prompt caching, usage accounting | **P0** | Free (the API is metered) | €0 for the SDK | Raw HTTP | Low — isolated behind `LlmClient` | **The real one**, mitigated by the seam | **Yes** |
| **Claude API — Opus 5 / Sonnet 5 / Haiku 4.5** | The engine's reasoning, extraction and classification | **P0** | Paid, metered | **P0 €1.2–3k · P1 €0.3–0.8k · P2 €0.5–1.5k · P3 €0.3–1k → €2.3–6.3k** | Another frontier provider | Low in code, **high in evaluation** — every prompt and threshold is tuned to a model | Behavioural, not contractual | **Yes** |
| **`vitest`** | Unit tests for the deterministic components, where a silent bug is invisible | **P0** | Free | €0 | `node:test` (zero dependencies) | Low | No | **Yes** |
| **`@types/node`** | Type definitions for the standard library | **P0** | Free | €0 | — | Low | No | **Yes** |
| **Methodology pack (YAML in the repo)** | The audit content itself — the IP, not a tool | **P0** | Free | €0 (SME time is in `07 §7.11`) | A database, a CMS | High later, trivial now | No | **Yes** |
| **Working-paper renderer (hand-written HTML)** | The neutral template for the blind test; format blinding is a requirement of the experiment | **P0** | Free | €0 | `docx`, `pandoc`, LaTeX | Low | No | **Yes** |
| **Word (existing licence)** | Variant C is produced by an auditor editing the document with tracked changes | **P0** | Already owned by every design partner | €0 | LibreOffice, Google Docs | Low | No | **Yes** |

**Not needed, and deliberately absent:** a bundler, a linter and formatter, a CSS framework,
a UI library, a database driver, an HTTP server, a queue, a logger, an ORM, a vector store,
an agent framework, a CLI argument library, and a `.docx` generation library.

> **On `.docx`:** Word opens the rendered HTML directly and saves it as `.docx` with tracked
> changes intact. That removes a document-generation dependency from Phase 0 entirely. Add
> one only if a design partner's template demands fidelity the HTML route cannot give.

---

## C. Evaluation and research tools

The evaluation is the point of Phase 0, and it needs almost no tooling.

| Tool | Purpose | Required in | Free/Paid | Phase 0–3 cost | Alternative | Switch | Lock-in | Decide now |
|---|---|---|---|---|---|---|---|---|
| **Filesystem + git for the C0 corpus** | Synthetic cases, answer keys, versioned with the pack that scored them | **P0** | Free | €0 | A corpus SaaS, a dataset registry | Low | No | **Yes** |
| **Encrypted local folder for the C1 corpus** | Anonymised historical cases, gitignored, never committed (`07 §7.2`) | **P0** | Free | €0 | Encrypted cloud storage | Low | No | **Yes** |
| **`packages/evals` (our own)** | M6 metrics, matching, variance, the M4 edit taxonomy | **P0** | Free | €0 | Langfuse, Braintrust, Promptfoo | Low | No | **Yes** — the metrics are audit-specific, no product knows them |
| **Rater scoring collection** | Six auditors × 3 cases of rankings and 1–7 scores | **P0** | Free | €0 | A rating web app | Low | No | **Yes** — use a spreadsheet, or the partner's own MS Forms |
| **Randomisation script** | Per-rater document order and label mapping for the blind test | **P0** | Free (a repo script) | €0 | Doing it by hand | Low | No | **Yes** |
| **Statistics** | Means and spread, reported with the sample size | **P0** | Free (computed in `evals`) | €0 | R, Python, Jupyter | Low | No | **No** — six raters is a directional test; nothing here needs a stats environment |

**Explicitly not adopted:** an LLM-observability platform (Langfuse, Braintrust, W&B,
Promptfoo). They are good products solving a problem Phase 0 does not have: the run manifest
already records model, prompt version, hashes, tokens and cost per stage, and the metrics that
matter are audit-specific. Revisit at Phase 2 when several people need to compare runs.

**Do not build a rating web app.** It is a week of work to replace a spreadsheet, and it
would be the clearest possible sign of building instead of testing.

---

## D. Deferred until later phases

Every item here is a real requirement — later. None is being installed, configured or paid
for now.

| Tool | Purpose | Adopt at | Expected cost from that phase | Recommended choice | Lock-in | Decide now |
|---|---|---|---|---|---|---|
| Managed PostgreSQL | Persistence, tenancy, RLS | **P1** | €0–25/mo | Neon or Supabase, EU region | Low (Postgres is portable) | No |
| Managed authentication | Auditor and client accounts, MFA | **P1** | €0–25/mo | Clerk or WorkOS | Medium | No |
| Application hosting | Running the web app | **P1** | €0–20/mo | Fly.io, Railway or Vercel, EU region | Low | No |
| Object storage | Documents and exports | **P2** | ~€1–5/mo | Cloudflare R2 or S3, EU | Low | No |
| Job queue | Background generation | **P1** | €0 | `pg-boss` on the same Postgres | Low | No |
| CI | Running tests and the eval suite on every change | **P1** | €0 | GitHub Actions | Low | No — Phase 0 runs locally |
| Linter and formatter | Consistency across contributors | **P1** | €0 | Biome (one dependency, not three) | Low | No — one author, strict TypeScript and tests are the bar |
| Error tracking and logging | Knowing something broke before a customer says so | **P2** | €0–30/mo | Sentry EU, Better Stack | Low | No |
| Managed OCR | Real PDF ingestion | **P2** | usage-based | Textract or Document Intelligence | Low | No |
| Transactional email | Client questionnaire invitations | **P2** | €0–20/mo | Resend or Postmark | Low | No |
| **EU-resident inference** | Class C3 audit-client data | **P2** | Same or slightly above list | Bedrock `eu-central-1`, or first-party with EU terms | Low — behind `LlmClient` | No, but **start the contractual conversation in P1**; it has lead time |
| Speech recognition | Recording walkthroughs | **P4** | usage-based | Bought, never self-hosted | Low | No |
| SSO / SAML / SCIM | Enterprise identity | **P5** | Provider tier | The auth provider's upgrade path | Low | No |
| Infrastructure as code, containers | Reproducible environments | **P2–P3** | €0 | Terraform, Docker | Low | No |
| Browser automation | End-to-end tests of a UI | **P2** | €0 | Playwright | Low | No — there is no UI |

---

## E. Review of what Phase 0 has already installed

Seven dependencies exist in the workspace today. Three findings.

| Dependency | Verdict |
|---|---|
| `zod` v4 | **Justified.** One definition for types, validation and model output. Pinned to v4 because the SDK's `zodOutputFormat` helper requires it — a coupling worth knowing, not a problem |
| `yaml` | **Justified.** The pack is reviewed by an auditor; comments are the reason it is not JSON |
| `@anthropic-ai/sdk` | **Justified and the only real lock-in.** Mitigated by the `LlmClient` interface: one file changes to move provider or to EU inference |
| `vitest` | **Justified**, though `node:test` would remove it entirely. Kept for watch mode and reporting across 30+ tests; switching cost is low if the minimalism becomes worth more than the ergonomics |
| `@types/node`, `typescript` | **Justified.** Development only |
| **`commander`** | **Unnecessary — removed.** Node 22's built-in `util.parseArgs` covers three subcommands. A CLI argument parser is exactly the kind of dependency the rule exists to catch |
| **`tsx`** | **Unnecessary — removed.** Node 22 executes TypeScript natively. It required rewriting three constructor parameter properties, which strip-only mode does not support — a small, permanent simplification: **no transpiler, no build step** |

**Result: four production dependencies (`zod`, `yaml`, `@anthropic-ai/sdk`, and the
workspace's own packages) and three development ones (`typescript`, `vitest`,
`@types/node`).** The engine runs on `node` with no build step.

**No premature dependency remains.** Nothing in the tree implies a database, a server, a
cloud provider or a framework, which is what keeps the Phase 1 architecture genuinely open.

---

## F. Phase 0 stack — approved

Install, subscribe to, configure or create an account for exactly this. Nothing else.

**Accounts and subscriptions (2 now, 1 at the API gate)**
1. **Claude Code** — already held on Claude Pro, $20/month. Upgrade only if usage limits throttle.
2. **GitHub account with a private repository** — free.
3. **Anthropic Console account + API key** — **not yet.** Needed at the API gate (§G),
   opened with a **$25 safety ceiling**, not a budget: enough to confirm the seam and take
   the first measurements, then topped up deliberately.

**Installed locally (4)**
4. **Node 22 LTS** (includes native TypeScript execution).
5. **pnpm**.
6. **VS Code** with the Claude Code extension.
7. **Git**.

**Configured, not installed (3)**
8. **Full-disk encryption** on the development machine.
9. **A password manager** for the API key and partner credentials — the key never goes in the repo.
10. **An encrypted, gitignored folder** for the C1 corpus, excluded from any consumer cloud sync.

**Created as files, not services (3)**
11. The **methodology pack** (`packages/methodology/packs/revenue/`).
12. The **corpus** (`corpus/synthetic/`, and `corpus/real/` when the agreement is in place).
13. The **decision log** and the **rater scoring sheet** (a spreadsheet).

**Total new cash commitment to start Phase 0: nothing.** The Claude Code subscription is
already held; everything else is free, already owned, or a file. The first new spend is the
$20–25 of API credit at the gate in §G.

**Not now:** database, authentication, hosting, object storage, CI, linter, observability,
OCR, email, EU inference infrastructure, speech recognition, SSO, containers, an
LLM-evaluation platform, a second AI coding tool, and a `.docx` library.


---

## G. The API gate — when a key becomes necessary

**A Claude Pro or Max subscription does not include API access.** They are separately
billed products: the subscription pays for Claude Code, the Console pays for the engine's own
model calls. Nothing built so far needs the second one.

### What runs today with no key at all

Everything deterministic, which is most of Phase 0's engineering:

- the methodology pack, its loader and its consistency validation;
- the coverage engine, the deterministic follow-up triggers and the mandatory-item logic;
- the grounding validator and output assembly;
- the neutral working-paper renderer;
- the corpus, answer keys and the metrics harness;
- the blind-test assignment, randomisation, scoring sheets, edit taxonomy and gate report;
- the full unit-test suite and `engine run --mock`, which exercises ingest → coverage →
  follow-ups → assemble → render end to end.

### The gate: the first real generation run

A key becomes necessary at exactly one moment — **when the engine must produce actual audit
content from a transcript.** Concretely, when any of these is needed:

1. **Confirming the one unverified integration point** — `messages.parse` with
   `output_config.format`. It is isolated in `packages/engine/src/llm.ts` and cannot be
   proved by a mock.
2. **Any M6 number that is not zero.** Coverage recall, risk recall, control recall and
   grounding rates all require real extraction. Under the mock they read 0% by construction.
3. **Producing variant B** for the blind test. There is no blind test without it, and no
   variant C either, since C is B after an auditor's edit.

In the §7.15 sequence that is **the start of week 3**, when the first end-to-end run is
scheduled. It cannot be deferred past week 4 without the phase stalling: the SME labelling in
week 5 and the blind test in week 7 both depend on real output existing.

**Not blocked by the gate:** cases 04–06 (done), the SME pack review, the SME realism pass on
the corpus, the corpus data-sharing agreement, recruiting the raters, and the firm's own
baseline authoring time for M3. Do all of that first — most of it has a longer lead time than
the key does.

### Setup checklist, at the gate

1. **Create the Console account** at `console.anthropic.com`, using the same work email as
   the rest of the venture. It is a separate account from the Claude Pro subscription.
2. **Add credit: $25.** Keep the two units of cost distinct, because they differ by a factor
   of six:

   | Unit | Cost | What $25 (≈ €23) buys |
   |---|---|---|
   | **One case** — a single transcript through all stages | **€0.90–1.60**, typically €1.20 | ≈ **19 single-case runs** |
   | **One smoke-suite run** — all six dev cases | **≈ €7** | ≈ **3 suite runs** |

   A realistic first week is one case to confirm the seam, five or six single-case runs while
   the prompts settle, then two suite runs — roughly €15–20, so the initial credit is nearly
   spent by the end of it. **Expect to top up during week 3 or 4.**

   The $25 is a **safety ceiling while the pipeline is unproven**, not the phase budget. The
   Phase 0 model budget remains **€1.2–3k** (§B); it arrives in deliberate top-ups rather than
   sitting in the account where a retry loop could reach it.
3. **Set a spend limit and an email alert** in the Console billing settings, at or just above
   the credit added. This is the cheapest protection against a loop that retries forever.
4. **Create a dedicated API key** named for the project (e.g. `audit-engine-phase0`), not a
   personal scratch key. One key, one purpose, revocable without collateral damage.
5. **The password manager is the source of truth for the key. It is never written to a shell
   profile**, where it would sit in plaintext and be injected into the environment of every
   process you run, including anything you install later.

   Two acceptable local approaches, in order of preference:

   ```bash
   # Best — the key never touches disk; it exists for the life of one command.
   ANTHROPIC_API_KEY="$(pass show audit-engine/api-key)" pnpm engine run corpus/synthetic/case-01
   op run --env-file=.env.tpl -- pnpm engine run corpus/synthetic/case-01     # 1Password

   # Acceptable — a gitignored working copy, loaded per invocation, not exported globally.
   cp .env.example .env.local     # paste the key from the password manager
   pnpm engine run corpus/synthetic/case-01
   ```

   `pnpm engine` runs `node --env-file-if-exists=.env.local`, so `.env.local` is read for that
   single command and nothing else. The repository gitignores `.env`, `.env.*` and keeps only
   `.env.example`. The key must never appear in a tracked file, a commit message, a terminal
   recording, or a screenshot shared with a design partner. **Rotate it in the Console the
   moment you suspect it has leaked** — it costs nothing and takes a minute.
6. **First command, one case, watching the cost:**
   ```bash
   pnpm engine run corpus/synthetic/case-01     # ONE case, not the suite
   pnpm engine costs
   ```
   Expect **€0.90–1.60 for the case**. If the first run costs materially more, stop and read
   the manifest before going anywhere near the suite — six times the unit cost is six times
   the mistake.
7. **From that run onward, cost is tracked per stage and per case** by `engine costs`, from
   the run manifests. Watch the cache hit rate: below 90% on suite runs means a silent prefix
   invalidator, and it shows up directly in the phase budget.

### Data classification at the gate

The first live runs use **C0 synthetic** cases only. Anonymised **C1** material may be sent
once the data-sharing agreement is in place. **C3 audit-client data never goes near this
setup** — that requires EU-resident inference and the Phase 2 platform (`07 §7.2`).
