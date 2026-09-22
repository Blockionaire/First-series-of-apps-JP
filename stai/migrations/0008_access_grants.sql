-- Complimentary access, recorded as what it is.
--
-- ── Why not just write a subscriptions row ──────────────────────────────
-- Because that would be a lie the system then has to live with. The
-- subscriptions table is the record of money: `first_payment_confirmed`,
-- `status`, `provider`, `current_period_end`. Forging a row to comp a friend
-- would put a payment that never happened into the payment record, make
-- /account render a price nobody was charged, and — the expensive part —
-- corrupt reconciliation on the day real payments are switched on, when every
-- "active" subscription is expected to match something at the provider.
--
-- So a grant is a separate fact with its own table, OR'd into the entitlement
-- decision. Money stays in `subscriptions`; generosity stays here; the gate
-- reads both.
--
-- ── Grants expire, and are revocable ────────────────────────────────────
-- `expires_at NULL` means indefinite, which is the right default for the
-- owner's own second account. A dated grant is the right shape for a friend,
-- a reviewer or a pilot firm, and dating it at the outset is what stops a
-- comp list quietly becoming permanent because nobody remembers who is on it
-- or why.
--
-- `revoked_at` rather than DELETE: who was given free access, by whom, and
-- when it was withdrawn, is exactly the sort of thing that has to survive
-- somebody changing their mind.
CREATE TABLE access_grants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Why this person has free access. Required by the API, not by the schema,
  -- because an unexplained comp is one nobody can review later.
  reason     TEXT NOT NULL DEFAULT '',
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  -- NULL = indefinite. Stored as an ISO instant, compared with datetime().
  expires_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT NOT NULL DEFAULT ''
);

-- The entitlement check runs on every authenticated request, so the lookup it
-- performs — "has this user a live grant" — is the one that must be indexed.
CREATE INDEX idx_access_grants_user ON access_grants(user_id, revoked_at, expires_at);
