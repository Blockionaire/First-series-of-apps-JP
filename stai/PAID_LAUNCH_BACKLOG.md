# Paid Launch Backlog

Payment work is **frozen**. STAI launches as a free public site with checkout
disabled. Nothing in this file is to be worked on until paid launch is
explicitly reprioritised.

**Freeze state verified in the production build (`aed7234`), running with no
`STRIPE_SECRET_KEY`:**

| Check | Result |
|---|---|
| `POST /api/checkout/sandbox` | `404` |
| `GET /checkout/sandbox` | `404` |
| `POST /api/checkout` (all three plans) | `503 {"error":"unavailable"}` — never a sandbox URL |
| `/plus` | renders "Membership opens shortly"; no checkout component mounts |
| Premium CTAs sitewide | plain `<a href="/plus">` links — no user can enter a Stripe flow |

Additionally, Next's standalone `server.js` hardcodes `NODE_ENV=production`,
so the sandbox route is unreachable in the production artifact independently of
the explicit guard.

---

## 0. Payment mutation is quarantined for the Cloudflare migration

Added during the Workers migration. **No payment behaviour was changed** — the
code was moved, not rewritten, and the entitlement rule was verified
byte-identical after the move.

Everything that MUTATES subscription state now lives in one module,
`src/lib/billing-frozen.ts`:

| Moved there, verbatim | Was in |
|---|---|
| `upsertSubscription`, `confirmFirstPayment` | `billing.ts` |
| `syncFromStripe`, `requestCancellation` | `billing.ts` |
| `claimFoundingSeat`, `refreshUserPlan`, the sync settings/entitlement helpers | `billing.ts` |

`billing.ts` keeps only read paths (`hasEntitlement`, `activeSubscription`,
`latestSubscription`, `foundingAvailable`, `PLANS`) and runs on the async seam.
`ENTITLEMENT_SQL` moved to `src/lib/entitlement.ts`, which imports nothing.
`stripeClient()` moved to `src/lib/stripe-client.ts` so that GDPR erasure —
a live free-launch route — does not depend on payment mutation code.

**Why:** `billing-frozen.ts` is the only module besides the Node database
driver that imports `./db`, and `./db` imports better-sqlite3, a native addon
Cloudflare Workers cannot load. Before the split, `auth.ts` imported
`ENTITLEMENT_SQL` from `billing.ts`, so **every page on the free site had a
static import path to a native addon through payment code**.

`tests/workers-boundary.test.mjs` enforces the quarantine: no free-launch route
may reach better-sqlite3, and the set of routes that may is pinned to exactly
the three payment routes.

### Deferred to paid launch — do not start these

- **Billing compare-and-swap rewrite.** `upsertSubscription` and
  `confirmFirstPayment` each read a value and branch on it inside a
  transaction. D1 has no interactive transaction; both must become
  compare-and-swap. That changes the behaviour of money-handling code and
  needs its own review — it is not migration housekeeping.
- **Stripe subscription mutation** on Workers (webhook signature verification
  with Web Crypto, and the Stripe SDK's Workers HTTP client).
- **Founding-seat concurrency** — see §3 below; the safe ordering under
  compare-and-swap happens to fix it, which is exactly why it should be done
  deliberately rather than as a side effect.
- **Stripe vs Whop vs Paddle decision.**
- **Real payment integration testing** in Stripe Test Mode.
- **VAT.**
- **Password recovery**, which becomes mandatory once anyone is paying.

Until then: `STRIPE_SECRET_KEY` stays unset, the three payment routes stay
quarantined, and the frozen module is never reachable in production.

---

## 1. Unsafe legacy payment-confirmation backfill — **blocker**

`src/lib/db.ts`, migration `mig_first_payment_backfill`:

```sql
UPDATE subscriptions SET first_payment_confirmed = 1
WHERE status IN ('active','past_due','trialing')
```

This infers payment from subscription status — the exact inference
`first_payment_confirmed` exists to eliminate. Pre-Phase-1 rows became `active`
from `checkout.session.completed` with no payment verification at all, and the
statement has no `provider` filter so sandbox rows are grandfathered too.

**Resolution when unfrozen:** replace with a no-op (column default `0`) so
production payment state starts clean. No genuine production payments exist —
the app has never been deployed. If real payments ever do exist, reconcile from
Stripe's paid invoices, never from status.

## 2. Founding-seat concurrency / oversell — **blocker**

Availability is checked at Checkout Session creation; the seat is claimed only
at payment confirmation. Nothing reserves anything in between — for delayed
methods that gap is days.

Simulated at 199/200 with 10 delayed-method checkouts: all 10 were allowed to
start, all 10 paid €12/month, **1** received `plan='founding'` and **9** were
silently rewritten to `plan='monthly'` while continuing to be billed €12. They
keep access but lose the founding record and the "locked for life" promise the
Terms page commits to.

**Candidate resolution:** restrict the founding offer to immediate-confirmation
payment methods (`payment_method_types: ["card"]` on founding only), and if a
seat is nonetheless gone at confirmation, honour `plan='founding'` and allow a
small visible overage rather than misrecording what the customer bought.

## 3. Real Stripe Test Mode integration tests — **blocker**

No test has ever executed against real Stripe objects or real webhook payloads.
`syncFromStripe`, `confirmFirstPayment` via webhook, and `constructEvent`
signature verification have **zero execution coverage**. Highest-risk unverified
line is the period-end extraction in `syncFromStripe`, which falls back through
two shapes and may store `NULL`.

Minimum sequence (Stripe CLI, test keys): card happy path asserting
`current_period_end` is non-NULL; proof that Subscription metadata carries
`userId`; SEPA delayed path asserting no access until `invoice.paid`; SEPA
failure path; first-invoice decline; cancel then `subscription.deleted`; replayed
`invoice.paid` for idempotency; founding overflow with `founding_total=1`.

## 4. Password reset — **blocker for paid, not for free**

No reset or email-verification flow exists. A paying member who forgets their
password is permanently locked out with no self-service path. Acceptable while
there are no paying users; mandatory before the first euro.

## 5. VAT / B2B checkout — **blocker (legal)**

No `automatic_tax`, no billing-address collection, no invoicing or PO handling.
Selling digital subscriptions across EU member states requires VAT at the
customer's rate and OSS reporting. Firms also need proper invoices.

## 6. Consumer withdrawal right — **blocker (legal)**

EU consumers may withdraw within 14 days of buying digital content unless they
give explicit consent to immediate access and acknowledge losing that right.
Needs a checkbox at checkout and a record of it.

## 7. Minor

- Dead top-level `metadata` on the Checkout Session (`src/app/api/checkout/route.ts`).
  Nothing reads it since the Phase 1 rewrite; delete or comment as vestigial so
  nobody assumes it is load-bearing.
- Cancellation UX copy on `/account` assumes a live subscription context.
