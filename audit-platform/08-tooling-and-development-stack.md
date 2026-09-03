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
| **Claude Code** | The implementation environment: writes, edits and reviews the code, drafts the methodology pack and corpus with the SME | **P0**, and every phase after | Paid subscription | **€100–200/mo × ~9 months ≈ €900–1,800** | Cursor, Copilot, Codex CLI | Low | No — it produces ordinary source in your repo | **Yes** |
| **Anthropic Console + API key** | Model access for the engine itself, billed separately from the subscription | **P0** | Pay-as-you-go | Model spend, see §B | — | Low | No | **Yes** |
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

**Accounts and subscriptions (3)**
1. **Claude Code subscription** — €100–200/month.
2. **Anthropic Console account + API key** — pay-as-you-go, budget **€1.2–3k** for Phase 0.
3. **GitHub account with a private repository** — free.

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

**Total new cash commitment to start Phase 0: the Claude Code subscription plus metered API
usage.** Everything else is free, already owned, or a file.

**Not now:** database, authentication, hosting, object storage, CI, linter, observability,
OCR, email, EU inference infrastructure, speech recognition, SSO, containers, an
LLM-evaluation platform, a second AI coding tool, and a `.docx` library.
