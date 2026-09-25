/**
 * Complimentary access: granting it, revoking it, and reading who has it.
 *
 * ── Deliberately not in billing.ts ──────────────────────────────────────
 * billing.ts owns money and, through billing-frozen.ts, the payment mutation
 * code that must stay unreachable while payments are disabled. Granting a
 * friend free access is not a payment event, involves no provider, and must
 * not import anything that could make it look like one. Keeping it here means
 * the comp path can never accidentally reach Stripe, and a reader can see that
 * from the import list alone.
 *
 * ── What a grant is not ─────────────────────────────────────────────────
 * It is not a subscription. Nothing here writes to `subscriptions`, sets
 * `first_payment_confirmed`, or invents a price. A granted member's /account
 * page says they were given access and by whom, because telling someone they
 * are paying when they are not is both untrue and, the first time they look
 * for the charge on a statement, alarming.
 */

import { sql } from "./sql";
import { GRANT_SQL } from "./entitlement";

export type Grant = {
  id: number;
  user_id: number;
  email: string;
  name: string;
  reason: string;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string;
};

export type GrantResult =
  | { ok: true; id: number; email: string; already: boolean }
  | { ok: false; error: string };

/**
 * Give one account STAI+ for nothing.
 *
 * Keyed on email because that is what an operator has in front of them, and
 * matched case-insensitively for the same reason. The account must already
 * exist: creating one here would mean inventing a password nobody chose, and
 * "sign up, then tell me" is one extra message rather than a security problem.
 *
 * Idempotent. Granting twice returns the existing live grant rather than
 * stacking a second one, so a double-click does not produce a row somebody has
 * to reason about later.
 */
export async function grantAccess(input: {
  email: string;
  reason: string;
  /** ISO date (YYYY-MM-DD) or empty for indefinite. */
  expiresOn?: string;
  actor: string;
}): Promise<GrantResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "An email address is required" };

  const reason = input.reason.trim();
  if (!reason) {
    // Enforced here rather than in the schema because the rule is editorial,
    // not structural: a comp list nobody can explain is one nobody can review.
    return { ok: false, error: "A reason is required — an unexplained grant cannot be reviewed" };
  }

  const user = await sql().first<{ id: number }>(
    "SELECT id FROM users WHERE lower(email)=? LIMIT 1",
    [email]
  );
  if (!user) {
    return {
      ok: false,
      error: `No account for ${email}. Ask them to sign up first, then grant it.`,
    };
  }

  let expires: string | null = null;
  if (input.expiresOn?.trim()) {
    const d = input.expiresOn.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { ok: false, error: "Expiry must be a date, as YYYY-MM-DD" };
    }
    // End of the named day, so "expires 31 December" means access through the
    // 31st rather than access ending as the 30th becomes the 31st.
    expires = `${d}T23:59:59.999Z`;
    if (Date.parse(expires) <= Date.now()) {
      return { ok: false, error: "That expiry date has already passed" };
    }
  }

  const live = await sql().first<{ id: number }>(
    `SELECT id FROM access_grants WHERE user_id=? AND ${GRANT_SQL} LIMIT 1`,
    [user.id]
  );
  if (live) return { ok: true, id: live.id, email, already: true };

  const info = await sql().run(
    `INSERT INTO access_grants (user_id, reason, granted_by, expires_at)
     VALUES (?, ?, ?, ?)`,
    [user.id, reason.slice(0, 300), input.actor, expires]
  );
  return { ok: true, id: info.lastRowId, email, already: false };
}

/**
 * Withdraw a grant.
 *
 * Stamped rather than deleted. Who was given free access, by whom, and when it
 * was taken away is exactly the sort of thing that has to survive somebody
 * changing their mind.
 */
export async function revokeAccess(id: number, actor: string): Promise<boolean> {
  const row = await sql().first<{ id: number }>(
    "SELECT id FROM access_grants WHERE id=? AND revoked_at IS NULL",
    [id]
  );
  if (!row) return false;
  await sql().run(
    `UPDATE access_grants
        SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), revoked_by = ?
      WHERE id = ?`,
    [actor, id]
  );
  return true;
}

/**
 * Every grant, live and ended, newest first.
 *
 * Ended ones are shown too: the question an operator asks is usually "did we
 * ever comp this person", and a list of only the current ones cannot answer
 * it.
 */
export async function allGrants(limit = 100): Promise<Grant[]> {
  return sql().all<Grant>(
    `SELECT g.id, g.user_id, u.email, u.name, g.reason, g.granted_by,
            g.granted_at, g.expires_at, g.revoked_at, g.revoked_by
       FROM access_grants g JOIN users u ON u.id = g.user_id
      ORDER BY g.granted_at DESC, g.id DESC
      LIMIT ?`,
    [limit]
  );
}

/** Is this grant live right now? Mirrors GRANT_SQL, for display only. */
export function grantIsLive(g: Pick<Grant, "revoked_at" | "expires_at">): boolean {
  if (g.revoked_at) return false;
  if (!g.expires_at) return true;
  return Date.parse(g.expires_at) > Date.now();
}

/** The live grant for one account, for the account page's own explanation. */
export async function liveGrantFor(userId: number): Promise<Grant | null> {
  const rows = await sql().all<Grant>(
    `SELECT g.id, g.user_id, u.email, u.name, g.reason, g.granted_by,
            g.granted_at, g.expires_at, g.revoked_at, g.revoked_by
       FROM access_grants g JOIN users u ON u.id = g.user_id
      WHERE g.user_id = ? AND ${GRANT_SQL}
      ORDER BY g.id DESC LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}
