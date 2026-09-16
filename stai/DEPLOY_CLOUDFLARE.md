# Running STAI on Cloudflare Workers

The target architecture:

```
Internet
  → Cloudflare Worker      (OpenNext-built Next.js 15.5 server)
  → D1                     (binding: DB)
  → ASSETS binding         (.next/static and public/)
```

No Docker, no Caddy, no VPS, no volume, no Litestream. `DEPLOY.md` describes
the single-machine path and is kept as the fallback; the two are alternatives,
not layers.

**Nothing in this file has been run against a real Cloudflare account.**
Everything below was executed locally against `wrangler dev` and Wrangler's
local D1. Deployment is a later, explicitly approved phase.

## Two build targets, two outputs

```bash
npm run build      # Node: .next/  (standalone server, better-sqlite3)
npm run cf:build   # Workers: .next-workers/ + .open-next/  (D1, no native code)
```

They must not share output or webpack cache, and they do not:

| | Node | Workers |
|---|---|---|
| `distDir` | `.next` | `.next-workers` |
| webpack cache version | `stai-node` | `stai-workers` |
| `src/lib/db.ts` | the real local SQLite module | replaced with `db-unavailable.ts` |
| database driver | better-sqlite3 | D1 |

Both separations exist because of bugs that were found, not anticipated. A
shared cache made a Node build silently reuse the Workers stub and ship a
server with no database — it compiled cleanly and failed at runtime. A shared
`distDir` made the Workers build overwrite the standalone server the Node test
suite boots.

## Which driver runs where

`src/lib/sql.ts` names no driver. `src/instrumentation.ts` installs one:

```
STAI_RUNTIME=workers   →  D1, via getCloudflareContext().env.DB
otherwise (Node)       →  better-sqlite3, and apply migrations + seeds locally
```

`NEXT_RUNTIME` cannot make this decision: OpenNext runs Next's *node* runtime
on Workers, so it reads `"nodejs"` in both places. `STAI_RUNTIME` is set in
`wrangler.jsonc` and is the only thing that distinguishes them.

A missing `DB` binding throws immediately and by name. There is no filesystem
fallback on Workers and there must never be one.

## Local Workers runtime

```bash
npm run cf:build
npm run d1:migrate:local     # wrangler d1 migrations apply stai --local
npm run d1:seed:local        # wrangler d1 execute --file=seeds/0001_...
npx wrangler dev             # http://localhost:8787
```

Verify:

```bash
curl -s localhost:8787/api/health
# {"status":"ok","runtime":"workers","db":{"driver":"d1","reachable":true,
#  "publishedArticles":11},"limiter":{"scope":"process","degradations":0}}
```

`runtime: workers` and `driver: d1` together are the proof that the Worker is
talking to D1 rather than to a file.

## The admin account is an operator action

On Node the account is created at boot from `STAI_ADMIN_EMAIL` /
`STAI_ADMIN_PASSWORD`. **A Worker must never do that** — it boots on every cold
isolate, and writing to the production database as a side effect of a deploy is
the behaviour the seeding rules exist to prevent.

```bash
node scripts/admin-sql.mjs desk@example.com 'a-long-password' > /tmp/admin.sql
npx wrangler d1 execute stai --local --file=/tmp/admin.sql
rm /tmp/admin.sql
```

The password is hashed by the script, so plaintext never reaches the database
or the file. `ON CONFLICT DO NOTHING` means re-running never resets a password
that was changed.

## Seeding is a deploy step, never a boot step

Migrations are applied by `wrangler d1 migrations apply`. Content is applied
once by `wrangler d1 execute --file=seeds/0001_verified_corpus.sql`. Every
statement in that file is guarded by a `seed_ledger` row, so applying it twice
changes nothing and applying it after an editor has changed something changes
nothing either.

After the initial seed the database is the source of truth. A later deploy can
never overwrite an edited article or prompt, republish a draft, reset gating,
or resurrect a slug an editor renamed or deleted.

## Payments stay frozen

`STRIPE_SECRET_KEY` is deliberately absent from `wrangler.jsonc` — absent, not
empty, so nothing can mistake an unset key for a configured one. Under the
Workers runtime: `/api/checkout/sandbox` 404, `/checkout/sandbox` 404,
`/api/stripe/webhook` 501, `/plus` shows the early-access waitlist.
`src/lib/billing-frozen.ts` is never reached. See `PAID_LAUNCH_BACKLOG.md`.

## Known gap before production

The rate limiter still reports `scope: "process"`. On Workers that means
per-isolate counting, which is not a real limit. It is safe for a local
runtime test and **is not safe as the production control for `/api/auth/login`
and `/api/auth/signup`**. See the Phase 3 report for the recommendation.
