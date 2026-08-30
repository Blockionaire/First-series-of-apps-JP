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
| For firms | `/firms` | The B2B front door: what ships today vs what's in development, with an enquiry form whose interest picker is the demand signal that decides build order |
| EU AI Act tracker | `/ai-act` | The launch asset — free, ungated reference on what changes 2 Aug 2026: applicability, Article 26 duties cited article-by-article, the six artefacts, penalties, timeline, FAQ schema |
| Account | `/account` | Bookmarks, saved answers, subscription management, GDPR erasure |
| Admin | `/admin` | Stats, **firm demand report**, firm + training enquiries, mail outbox, and a no-redeploy content editor (search index refreshes on save) |

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

## Commercial design decisions worth knowing

These are deliberate and reversible, but don't change them by accident.

**The prompt library is distribution, not the product.** 20 of 31 prompts are
open; the 11 behind the gate are the deepest instruments (`src/lib/seed/gating.ts`).
What STAI+ actually sells is the *tooling* — adapt-with-AI and unlimited Ask
STAI — because an auditor who finds a good prompt forwards it to colleagues,
and that loop is worth more than the marginal subscription. **Every category
must keep at least one open prompt**: a fully locked category reads as an empty
shelf to the specialist who filters to it.

**The founding counter never lies, but chooses what to lead with.** Below
`FOUNDING_PROGRESS_THRESHOLD` (10 claimed) the claimed count and progress bar
are suppressed and the page leads with "claim seat 1 of 200" — equally true,
and reads as early access rather than as an empty room. Never seed the count.

**The benchmark stays silent until it's honest.** Peer comparisons need
`MIN_SAMPLE` (25) responses before anything is shown, and the sample size is
always displayed. A percentile from a handful of responses is noise wearing a
statistic — exactly what this publication criticises elsewhere.

**Seeding is additive.** `runSeed` inserts with `ON CONFLICT DO NOTHING`, so a
seed-version bump can never destroy CMS-authored articles or editor changes to
seeded ones. Deliberate changes to already-seeded rows go through
`runDataMigrations` in `db.ts`, keyed in settings so they run exactly once.

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

## SEO

Search surfaces are first-class, not bolted on:

- `sitemap.xml` (every article, prompt, category and author, priced by
  editorial priority), `robots.txt`, and an RSS feed at `/feed.xml`.
- A single `pageMeta()` builder in `src/lib/seo.ts` gives every route a
  canonical URL plus complete OpenGraph/Twitter cards. Private surfaces
  (account, admin, checkout, login) are explicitly `noindex`.
- **Share images are generated on our own server** via `next/og`
  (`src/lib/og.tsx`) — navy card, hairline frame, gold only when the piece
  is STAI+. Nothing is fetched at runtime, so the firewall guarantee holds.
- **Structured data**: Organization + WebSite site-wide; `AnalysisNewsArticle`
  with author `Person` and `BreadcrumbList` per briefing; `CollectionPage` +
  `ItemList` on category pages; `ProfilePage`/`Person` on authors; `Course` +
  `Offer` (with `priceValidUntil`) on training; `PodcastSeries`.
- **Paywall markup**: premium briefings serve a truncated body with
  `isAccessibleForFree: false` and a `hasPart` selector naming the gated
  region. Serving cut content *without* this is what search engines treat as
  cloaking; with it, the piece indexes honestly.
- **Crawlable topic pages** at `/briefing/category/[category]` and author
  pages at `/authors/[slug]` — the filter chips are a client-side lens, but
  every beat and every byline also has a real, linkable, indexable URL.

## Accessibility & motion

Keyboard paths everywhere (the Radar included: arrows cycle, Enter opens, with a
live text readout). `prefers-reduced-motion` stills the ticker, the hero field,
the sweep and reveals. Focus rings are cream; gold focus is reserved — like gold
itself — for STAI+ controls only.

Contrast is held to WCAG AA in **both** themes. The `--ink-faint` token is the
one to watch: it carries every mono label, index number and timestamp on the
site, so it is set at 0.58 (dark) / 0.64 (light), measuring 5.1–5.8:1. Earlier
values around 0.38/0.46 measured ~3:1 and failed. Do not lower them.

Article measure is capped at 40rem (≈68 characters) — the long-form comfort
range. The headline shares the body column's left edge; the file rail runs
beside the prose.

## Brand rule enforced in code

Gold (`--color-gold-*`, `.btn-plus`, `PlusBadge`, `SPlusMark`) appears **only**
on paid/premium elements. Cream is the everyday accent. If a diff adds gold to a
free surface, reject it.

## Security posture

Built to survive a procurement review by the kind of firm that reads our own
"twelve questions" piece.

- **No default credentials, ever.** The seed creates an admin account only when
  `STAI_ADMIN_EMAIL` and `STAI_ADMIN_PASSWORD` (12+ chars) are both set. In
  development it generates a random password per database and prints it once.
  In production without them, no admin exists at all.
- **Strict CSP with a per-request nonce** (`src/middleware.ts`) plus HSTS,
  `X-Frame-Options: DENY`, `nosniff`, a restrictive `Permissions-Policy` and
  same-origin COOP/CORP. We can afford `default-src 'self'` because nothing
  is loaded from a third party at runtime. `style-src` keeps `'unsafe-inline'`
  because the design system sets custom properties via React style attributes.
- **Rate limiting on every mutating route** (`src/lib/ratelimit.ts`). These are
  *burst* limits, never per-IP entitlements — a whole firm can share one egress
  IP, so product quotas are metered per account/cookie instead.
- **Ask STAI has a hard monthly spend ceiling.** Past it, the assistant degrades
  to retrieval-only rather than billing onward. Anonymous quota is a product
  gate; the ceiling is the cost stop.
- **Markdown is sanitised at render** with a tag/attribute allowlist, so a
  compromised editor account cannot become stored XSS on readers. External
  links get `noopener noreferrer nofollow`.
- **Billing activation is idempotent and race-safe.** Repeat Stripe webhook
  deliveries can't double-charge a founding seat; the seat check happens inside
  the transaction.
- **Sessions** are 32-byte random tokens, httpOnly + SameSite=Lax + Secure in
  production, with expired rows purged opportunistically.
- **GDPR Art. 17 erasure** is implemented at `/account` — password-confirmed,
  cancels billing, and removes every row including the newsletter subscription.

## Deploy

`npm run build && npm start` behind any Node host. The SQLite file lives in
`data/` — mount it persistently. For serverless (Vercel), move `src/lib/db.ts`
to Postgres/Turso first; everything above it is storage-agnostic.

Recommended: a single **EU VPS** (Hetzner/Scaleway) behind Caddy for automatic
TLS. That keeps the data-residency claim literally true, which matters more to
this audience than horizontal scale they don't need yet.

**Backups.** `node scripts/backup.mjs [dir]` takes a verified point-in-time
snapshot via SQLite's online backup API — safe against a live database. Run it
hourly from cron. For production, also run **Litestream** against
`data/stai.db` for continuous replication to EU object storage; the script is
the floor, not the goal.

### Before the domain resolves

- [ ] Set `STAI_ADMIN_EMAIL` / `STAI_ADMIN_PASSWORD`, then verify `/admin`.
- [ ] Confirm the founding counter reads 0 claimed on `/plus`.
- [ ] SPF, DKIM and DMARC on the sending domain; send a test to a Gmail and an
      Outlook address before the first Brief.
- [ ] Stripe: live keys, webhook endpoint + secret, **Stripe Tax enabled** for
      EU VAT, and a 14-day withdrawal-right waiver at checkout for consumers.
- [ ] Replace the author biographies in `src/lib/authors.ts` with real people,
      or collapse to a single editorial byline. They are currently written
      placeholders and must not go live as fact.
- [ ] Complete the GDPR notice: lawful bases, retention periods, and the
      sub-processor list (Anthropic, Stripe, mail provider, host).
- [ ] Add the company imprint (registration + VAT number) — a legal requirement
      in several of our largest markets.
- [ ] Backups running and a restore rehearsed at least once.
