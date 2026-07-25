# STAI — Signal & Training for Audit Intelligence

The intelligence platform for audit, accountancy and finance professionals across Europe.
An *editorial intelligence terminal*: the live-data seriousness of a market terminal married
to the polish of a premium publication.

```bash
npm install
npm run dev      # http://localhost:3000 — seeds its own database on first boot
```

No environment variables are required to run the full product. Every external
integration degrades gracefully (see "Runs anywhere" below).

## What's inside

| Surface | Route | Notes |
| --- | --- | --- |
| The Signal Desk (home) | `/` | Canvas signal-field hero, live ticker, EU AI Act enforcement clock, editorial front page, founding-member scarcity |
| The Briefing | `/briefing` | Article index + **the Radar**: canvas sweep display plotting every piece by category sector, recency and urgency. Keyboard-operable, reduced-motion safe, always paired with the full list |
| Article reading | `/briefing/[slug]` | File-reference rail, TOC, reading progress, citation block, server-side premium gating |
| Prompt Library | `/prompts` | 28 audit-grade prompts across 9 categories; free slice open, full canon on STAI+ |
| Adapt with AI | `/prompts/[slug]` | STAI+ instrument panel: client/sector/jurisdiction/framework → Claude rewrites the prompt with guardrails intact + "what changed" rationale. Deterministic offline merge without an API key |
| Ask STAI | `/ask` | Streaming answers grounded ONLY in the platform's own articles via local BM25 retrieval; per-article `[n]` citations, sources rail, quota gating (anon 2 → free 5/mo → plus unlimited), retrieval-only fallback without a key |
| Working-paper export | Ask + Adapt | Any answer or adapted prompt exports as a print-ready, reference-numbered memo an auditor could file |
| Podcast / Research | `/podcast` `/research` | 8 episodes; 8 curated papers, each with a "STAI takeaway" translating it into practice consequences |
| Training | `/training` | Three programmes (€1,195 / €2,245 / €5,625) with 25% early-bird to 31 Aug 2026; enquiries persist to DB + outbox, confirmation mail, `STAI-TRN-xxxx` refs |
| Assessment | `/assessment` | 8-question maturity diagnostic across Governance/People/Practice/Evidence; four bands with tailored verdicts and next moves; results stored, emailable |
| STAI+ | `/plus` | €19/mo, €149/yr, founding €12/mo locked forever — live seat counter driven by real subscriptions |
| Account | `/account` | Bookmarks, saved answers, subscription management |
| Admin | `/admin` | Stats, enquiries, mail outbox, and a no-redeploy content editor (search index refreshes on save) |

## Stack & the reasoning

- **Next.js 15 (App Router) + TypeScript + Tailwind v4.** Server components everywhere content is read; client components only where interaction demands them.
- **SQLite (better-sqlite3) as content store + CMS.** The deciding constraint is the audience: locked-down audit-firm networks. No external CMS endpoint to be firewalled, no service to subscribe to; `/admin` edits publish instantly. The data layer is one file (`src/lib/db.ts`) — swapping to Postgres later is contained.
- **Local BM25 retrieval** (`src/lib/search.ts`) grounds Ask STAI. The corpus is small; lexical retrieval is transparent and reproducible — an auditor's virtue — and nothing leaves the box. Swap for pgvector + embeddings at 100× scale; the interface holds.
- **Anthropic API, server-side only** for Ask STAI + adapt. The browser never calls a third party.
- **Stripe subscriptions** with a sandbox checkout fallback (auto-disabled the moment real keys exist) so the full subscribe → founding-counter → premium-unlock journey is demoable end to end.
- **Outbox-pattern email**: every message is durably stored first, relayed via Resend when configured, and visible in `/admin` — an enquiry can never silently vanish.
- **Fonts bundled from npm** (`@fontsource-variable/archivo` + `jetbrains-mono`). Archivo's variable *width axis* provides both the heavy condensed display face and the body sans from one file. Zero runtime font/CDN requests.

## Runs anywhere (the firewall constraint)

Zero third-party requests at runtime from the browser: no CDN fonts, no icon
services, no analytics, no client-side API calls to anyone. Canvas visuals
(signal field, radar, waveforms) are hand-rolled — no three.js payload.
Server-side integrations degrade honestly:

| Missing env | Behaviour |
| --- | --- |
| `ANTHROPIC_API_KEY` | Ask STAI → retrieval-only mode (cited passages, labelled as such); Adapt → deterministic context merge, labelled |
| `STRIPE_SECRET_KEY` (+ `STRIPE_WEBHOOK_SECRET`) | Checkout → sandbox flow with identical activation path |
| `RESEND_API_KEY` (+ `MAIL_FROM`) | Mail stays queued in the outbox, visible in admin |
| `STAI_ADMIN_EMAIL` / `STAI_ADMIN_PASSWORD` | Dev admin seeded as `desk@stai.ai` / `stai-desk-2026` — **set these in production** |
| `TRAINING_INBOX` | Enquiry notifications default to `training@stai.ai` |

## Theming

Two themes, one component tree. Dark (default) is the intelligence terminal;
light is bright beige with navy ink — toggled from the system bar, persisted in
a `stai_theme` cookie so the server renders the right theme with no flash.
Implementation is a token remap under `html[data-theme="light"]` in
`globals.css`: "navy" tokens become the beige surface scale and "cream" tokens
become the navy ink scale, so every existing pairing inverts together and
contrast is preserved by construction. The hand-drawn canvases (signal field,
radar) read the theme per frame via `src/lib/theme.ts`. Gold remains
premium-only in both themes; its text shade deepens on beige for contrast.

## Accessibility & motion

Keyboard paths everywhere (the Radar included: arrows cycle, Enter opens, with a
live text readout). `prefers-reduced-motion` stills the ticker, the hero field,
the sweep and reveals. Focus rings are cream; gold focus is reserved — like gold
itself — for STAI+ controls only.

## Brand rule enforced in code

Gold (`--color-gold-*`, `.btn-plus`, `PlusBadge`, `SPlusMark`) appears **only**
on paid/premium elements. Cream is the everyday accent. If a diff adds gold to a
free surface, reject it.

## Deploy

`npm run build && npm start` behind any Node host. The SQLite file lives in
`data/` — mount it persistently. For serverless (Vercel), move `src/lib/db.ts`
to Postgres/Turso first; everything above it is storage-agnostic.
