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
local D1. The Phase 4 runbook at the end of this file is written but unrun:
the agent environment cannot complete Wrangler's browser OAuth, because the
callback is bound to `http://localhost:8976` inside its own container. Run it
from a machine where you can log in.

## Two build targets, two outputs

```bash
npm run build      # Node: .next/  (standalone server, better-sqlite3)
npm run cf:build   # Workers: .next/ → .open-next/  (D1, no native code)
```

| | Node | Workers |
|---|---|---|
| webpack cache version | `stai-node` | `stai-workers` |
| `src/lib/db.ts` | the real local SQLite module | replaced with `db-unavailable.ts` |
| database driver | better-sqlite3 | D1 |

**The two targets are separated in time, not by directory.** Both scripts start
with `rm -rf .next`, and only one build's output exists at a time. An earlier
version of this file claimed the Workers build used a separate `distDir`; it
does not, because OpenNext reads `.next` unconditionally and ignores `distDir`.
Relying on that produced a run where a "Workers" bundle was built from Node
output with the native addon included.

The cache split exists for a related reason: a shared webpack cache made a Node
build silently reuse the Workers stub and ship a server with no database. It
compiled cleanly and failed only at runtime.

This is why `npm run cf:inspect` exists — never trust that the last build was
the one you think it was.

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
npm run d1:migrate:local     # wrangler d1 migrations apply stai-production --local
npm run d1:seed:local        # wrangler d1 execute --file=seeds/0001_...
npx wrangler dev             # http://localhost:8787
```

Verify:

```bash
curl -s localhost:8787/api/health
# {"status":"ok","runtime":"workers","db":{"driver":"d1","reachable":true,
#  "publishedArticles":11},
#  "limiter":{"scope":"global","healthy":true,"degradations":0}}
```

`runtime: workers` and `driver: d1` together are the proof that the Worker is
talking to D1 rather than to a file.

`limiter.scope` must read `global`. `process` there means the Durable Object
store did not register and the Worker is counting per isolate — which is not a
limit at all, because isolates are created and discarded constantly. Treat it
as a failed deploy, not a warning.

`healthy: false` with a rising `degradations` means the store is registered but
unreachable, so requests are falling back to in-process counting. The site
stays up and still refuses abusive callers, but the counters are no longer
shared. The authoritative signal is the `[ratelimit] degraded` warning in the
Workers logs; the health counter is per isolate and so can under-report.

## The admin account is an operator action

On Node the account is created at boot from `STAI_ADMIN_EMAIL` /
`STAI_ADMIN_PASSWORD`. **A Worker must never do that** — it boots on every cold
isolate, and writing to the production database as a side effect of a deploy is
the behaviour the seeding rules exist to prevent.

```bash
node scripts/admin-sql.mjs desk@example.com 'a-long-password' > /tmp/admin.sql
npx wrangler d1 execute stai-production --local --file=/tmp/admin.sql
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

## The rate limiter is a Durable Object

`RateLimiterDO` (`worker/rate-limiter-do.ts`) holds the counters. Two things
about it matter at deploy time:

1. **The class is exported from `worker/entry.ts`, not from the OpenNext
   bundle.** `wrangler.jsonc` sets `main` to that wrapper, which re-exports
   `.open-next/worker.js` verbatim and adds the one class OpenNext knows
   nothing about. `.open-next/worker.js` is regenerated by every build, so it
   cannot hold the export itself.

2. **Its storage backend is chosen once and cannot be changed.** The
   `migrations` block declares `new_sqlite_classes: ["RateLimiterDO"]`. A class
   first deployed on the older key-value backend cannot be converted to SQLite
   later — it would have to be renamed and its counters abandoned. Since no
   remote deploy exists yet, this is still free to get right; after the first
   `wrangler deploy` it is not.

The first remote deploy applies the Durable Object migration automatically.
No separate command, and nothing to seed — counters start empty by design.

### A build-time warning that is expected

Both `npm run build` and `npm run cf:build` print:

```
A DurableObjectNamespace in the config referenced the class "RateLimiterDO",
but no such Durable Object class is exported from the worker.
```

This is not a problem with the deploy. `next.config.ts` calls
`initOpenNextCloudflareForDev()`, which starts a miniflare instance to supply
bindings during the Next build; that instance loads `wrangler.jsonc` but has no
Worker script, so it cannot see the export. The script that actually ships is
bundled later, by wrangler, from `worker/entry.ts`.

To confirm the export is really there, without contacting Cloudflare:

```bash
node scripts/inspect-bundle.mjs
# ok  deployable bundle exports RateLimiterDO
```

That check runs a real `wrangler deploy --dry-run`, which needs no credentials
and deploys nothing. The accompanying "These will not work in local
development" warning refers to `next dev`, where `STAI_RUNTIME` is not
`workers`, the Durable Object store is never registered, and the in-process
limiter is used deliberately.

---

# Phase 4 runbook — first real deployment

Run these in order from a machine where you can complete a browser login.
Every step has a check; do not continue past a failing one.

Nothing here has been executed against a real account. Commands that create or
change a Cloudflare resource are marked **[creates]**.

## 0. Log in

```bash
npx wrangler login          # [creates] an OAuth token in ~/.config/.wrangler
npx wrangler whoami
```

`whoami` prints the account name and account ID. Confirm it is the account you
intend before anything else. If you have more than one account, set the right
one for every later command:

```bash
export CLOUDFLARE_ACCOUNT_ID=<id from whoami>
```

Check nothing is already there under a name you care about:

```bash
npx wrangler d1 list
npx wrangler deployments list --name stai   # errors if the Worker does not exist — that is fine
```

**Stop** if a Worker named `stai` or a D1 named `stai-production` already
exists and you did not create it.

## 1. Production D1 — already done

`stai-production` was created in the dashboard and `wrangler.jsonc` carries its
real `database_id`. Nothing to run here.

If you ever recreate it, the name in `wrangler.jsonc` must match the name in
the dashboard. Wrangler addresses a database by name on the command line and by
id in the binding, so a mismatch gives you a Worker that talks to the right
database while every `d1 execute` you type edits a different one — or none.
That is why the local npm scripts and the Workers test harness were renamed
alongside it; `grep -rn "stai-production"` finds every place that has to agree.

The database id is not a secret. It names a resource, it does not grant access
to one, so it belongs in git.

## 2. Migrations

```bash
npx wrangler d1 migrations list stai-production --remote
npx wrangler d1 migrations apply stai-production --remote     # [creates]
```

Verify — expect the tables from `migrations/0001_initial_schema.sql` plus
`d1_migrations`:

```bash
npx wrangler d1 execute stai-production --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
npx wrangler d1 execute stai-production --remote --command \
  "SELECT name FROM d1_migrations ORDER BY id"
```

**Stop** if a migration fails or the table list differs from local. Do not
patch the remote schema by hand — that desynchronises it from the migration
system permanently.

## 3. Seed, once

```bash
npx wrangler d1 execute stai-production --remote \
  --file seeds/0001_verified_corpus.sql                       # [creates]
```

Verify:

```bash
npx wrangler d1 execute stai-production --remote --command \
  "SELECT (SELECT COUNT(*) FROM articles WHERE status='published') AS articles,
          (SELECT COUNT(*) FROM prompts  WHERE status='published') AS prompts,
          (SELECT COUNT(*) FROM prompts  WHERE premium=1)          AS premium,
          (SELECT COUNT(*) FROM seed_ledger)                       AS ledger"
```

Expect 11 articles, 31 prompts, 11 premium, and a non-empty ledger.

Re-running the seed is safe and is worth proving once: every statement is
guarded by `seed_ledger`, so a second apply changes nothing and cannot
overwrite an editor's work.

## 4. Admin account

`scripts/admin-sql.mjs` hashes the password with bcrypt and prints SQL. The
plaintext never reaches the database, a file, or this repository.

```bash
read -r -p  "admin email: " ADMIN_EMAIL
read -r -s -p "admin password: " ADMIN_PASSWORD; echo      # -s: not echoed to the terminal
node scripts/admin-sql.mjs "$ADMIN_EMAIL" "$ADMIN_PASSWORD" > /tmp/admin.sql
unset ADMIN_PASSWORD

npx wrangler d1 execute stai-production --remote --file /tmp/admin.sql   # [creates]
rm -f /tmp/admin.sql
```

Verify the role, never the password:

```bash
npx wrangler d1 execute stai-production --remote --command \
  "SELECT email, role FROM users WHERE role='admin'"
```

If your shell records history, clear the two `read` lines afterwards.

## 5. Variables

`wrangler.jsonc` already carries everything the free launch needs:
`STAI_RUNTIME=workers`, `APP_URL=https://stai-ahead.com`, the `DB` binding and
the `RATE_LIMITER` Durable Object.

Set **no** secrets. `STRIPE_SECRET_KEY` must stay unset — that is what keeps
checkout unavailable and the sandbox path unreachable. Ask STAI runs in
retrieval-only mode without `ANTHROPIC_API_KEY`; leave it unset for this
deployment.

## 6. Deploy to workers.dev

```bash
npm run cf:build
npm run cf:inspect            # native addons 0, DO exported, size within limits
npx wrangler deploy           # [creates] the Worker
```

Wrangler prints the `*.workers.dev` URL. The custom domain is not attached yet.

## 7. Smoke test the real deployment

```bash
node scripts/smoke-remote.mjs https://<printed-workers.dev-url>
```

39 read-only checks: health, `runtime: workers`, `driver: d1`, seeded article
count, **`limiter.scope: "global"`**, every public page, every published
briefing and prompt from the sitemap, canonical metadata, `/admin` refusing
anonymous callers, and the payment freeze. Exits non-zero on any failure.

Canonical URLs will name `stai-ahead.com` while you are still on workers.dev.
That is deliberate — a workers.dev canonical is exactly what you do not want a
crawler to index — so run it as:

```bash
EXPECT_ORIGIN=https://stai-ahead.com node scripts/smoke-remote.mjs https://<workers.dev-url>
```

The write paths are not in that script, because a script that cleans up after
itself in production is a script that can delete the wrong row. Do these by
hand, in the browser, with obviously-named test data:

- sign up, log out, log back in, confirm the session persists across a reload;
- confirm a non-admin account cannot reach `/admin`;
- sign in as the admin: `/admin`, the article editor, the prompt editor, the
  growth dashboard;
- create a draft article `zz-deploy-test`, edit it, publish, confirm it appears
  on `/briefing`, unpublish, confirm it disappears;
- create a draft prompt `zz-deploy-test`, edit it, confirm persistence;
- ask Ask STAI a question, confirm citations resolve to real briefings;
- unpublish a briefing and confirm it drops out of retrieval;
- submit an early-access signup and confirm the row appears.

## 8. Persistence proof

Workers are stateless; prove the data is in D1 and not in an isolate.

```bash
# with zz-deploy-test still present:
npx wrangler deploy                                   # redeploy, D1 untouched
npx wrangler d1 execute stai-production --remote --command \
  "SELECT slug, status FROM articles WHERE slug='zz-deploy-test'"
```

The row must still be there. Then remove **only** the test content:

```bash
npx wrangler d1 execute stai-production --remote --command \
  "DELETE FROM articles WHERE slug='zz-deploy-test'"
npx wrangler d1 execute stai-production --remote --command \
  "DELETE FROM prompts  WHERE slug='zz-deploy-test'"
```

Never `d1 delete` the database.

## 9. Logs

```bash
npx wrangler tail --format pretty
```

Exercise the site in another window and watch for exceptions, D1 errors,
Durable Object errors, `[ratelimit] degraded`, and missing-binding messages.
`[ratelimit] degraded` means the Durable Object is unreachable and counting has
fallen back to per-isolate — investigate before going further.

## 10. DNS, then the custom domain

Look before you touch anything:

```bash
npx wrangler dns record list stai-ahead.com 2>/dev/null || \
  echo "use the dashboard: stai-ahead.com > DNS > Records"
```

Write down every **MX** record and every **TXT** record containing
`cloudflare-email-routing` or `v=spf1`. Inbound email for `info@`, `support@`,
`help@` and `partner@` depends on them.

Attaching a Workers custom domain creates or replaces the proxied record for
**that hostname only** (`stai-ahead.com`). It does not read or modify MX or
TXT records, so email routing survives. **Stop and check** if an A, AAAA or
CNAME record already exists at the apex — attaching will replace it, and
whatever it pointed at will stop receiving traffic.

Attach in the dashboard: **Workers & Pages → stai → Settings → Domains &
Routes → Add → Custom domain → `stai-ahead.com`**.

Then:

```bash
curl -sI https://stai-ahead.com/api/health | head -1
curl -s  https://stai-ahead.com/api/health
node scripts/smoke-remote.mjs https://stai-ahead.com
```

Confirm the certificate is Cloudflare-issued and valid:

```bash
echo | openssl s_client -connect stai-ahead.com:443 -servername stai-ahead.com 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates
```

## 11. www → apex

Use a redirect rule, not a second custom domain: two Workers custom domains
would give you two live canonical origins, which is the thing to avoid.

1. DNS → add a **proxied** `AAAA` record for `www` pointing at `100::`
   (the documented discard address; the proxy answers, the origin is never
   used). Leave MX and TXT untouched.
2. Rules → **Redirect Rules** → Create:
   - When: `http.host eq "www.stai-ahead.com"`
   - Then: dynamic redirect, **301**, preserve query string,
     expression: `concat("https://stai-ahead.com", http.request.uri.path)`

Confirm:

```bash
curl -sI https://www.stai-ahead.com/briefing | head -3
# expect: HTTP/2 301  +  location: https://stai-ahead.com/briefing
```

## 12. Final URL check

`APP_URL` is already `https://stai-ahead.com`, so no redeploy should be needed.
Confirm nothing stale is being served:

```bash
curl -s https://stai-ahead.com/ | grep -oE '<link rel="canonical"[^>]*>'
curl -s https://stai-ahead.com/sitemap.xml | grep -c 'workers.dev\|localhost'   # expect 0
```
