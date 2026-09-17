import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "./sql";
import { ENTITLEMENT_SQL } from "./entitlement";

export type User = {
  id: number;
  email: string;
  name: string;
  firm: string;
  role: string;
  plan: "free" | "plus";
  founding: boolean;
};

const SESSION_COOKIE = "stai_session";
const SESSION_DAYS = 30;

export async function createUser(email: string, password: string, name: string, firm: string) {
  const hash = await bcrypt.hash(password, 10);
  const info = await sql().run(
    "INSERT INTO users (email, password_hash, name, firm) VALUES (?, ?, ?, ?)",
    [email.toLowerCase().trim(), hash, name.trim(), firm.trim()]
  );
  return info.lastRowId;
}

/**
 * A bcrypt hash of a random value nobody holds, at the same cost factor as a
 * real one. Compared against when no account matches, so that "no such user"
 * and "wrong password" take the same time.
 *
 * Without it the two answers are trivially distinguishable: a missing account
 * returns as fast as one SELECT, a real one pays for a cost-10 bcrypt — tens
 * of milliseconds, far above network noise when sampled. That turns the login
 * endpoint into an oracle for "is this person a customer", which for an
 * audit-sector product is commercially sensitive.
 */
const ABSENT_USER_HASH = "$2b$10$zaJ60hJp3tZPLAGKN4Y4MeG38HPfpZ0ux3VCWyAC9RXrScNzqwDCW";

export async function verifyUser(email: string, password: string): Promise<number | null> {
  const row = await sql().first<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email=?",
    [email.toLowerCase().trim()]
  );
  if (!row) {
    await bcrypt.compare(password, ABSENT_USER_HASH);
    return null;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  return ok ? row.id : null;
}

export async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  // Opportunistic purge alongside the insert: expired rows would otherwise
  // accumulate forever. Batched so the two writes are one round trip.
  await sql().batch([
    { sql: "DELETE FROM sessions WHERE expires_at <= datetime('now')" },
    {
      sql: "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
      params: [token, userId, expires.toISOString()],
    },
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql().run("DELETE FROM sessions WHERE token=?", [token]);
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // `plan` is DERIVED from live subscription state, never read from the users
  // row. A stored "plus" flag has no expiry, so a lapsed or cancelled member
  // would otherwise keep access indefinitely. One rule (ENTITLEMENT_SQL),
  // evaluated here, governs every gate on the platform.
  const row = await sql().first<
    Omit<User, "plan" | "founding"> & { entitled: number; founding: number }
  >(
    `SELECT u.id, u.email, u.name, u.firm, u.role,
              EXISTS (
                SELECT 1 FROM subscriptions sub
                WHERE sub.user_id = u.id AND ${ENTITLEMENT_SQL}
              ) AS entitled,
              EXISTS (
                SELECT 1 FROM subscriptions sub
                WHERE sub.user_id = u.id AND sub.plan = 'founding' AND ${ENTITLEMENT_SQL}
              ) AS founding
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token=? AND s.expires_at > datetime('now')`,
    [token]
  );
  if (!row) return null;
  const { entitled, ...rest } = row;
  return { ...rest, plan: entitled ? "plus" : "free", founding: !!row.founding };
}

/** Read-only anon id — safe in server components (no cookie write). */
export async function peekAnonId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("stai_anon")?.value ?? null;
}

/** Stable anonymous id for metering free tastes without an account. Route handlers only. */
export async function anonId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get("stai_anon")?.value;
  if (!id) {
    id = crypto.randomBytes(12).toString("hex");
    jar.set("stai_anon", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return id;
}

/**
 * Monthly usage metering, e.g. the Ask STAI free-tier quota. Returns the count
 * AFTER the increment.
 *
 * One statement, via RETURNING, rather than an UPSERT followed by a SELECT.
 * Two statements were both slower — two round trips to D1 on every metered
 * request — and wrong under concurrency: D1 has no interactive transaction, so
 * two requests could interleave between the write and the read and both see
 * the same total, handing out more free questions than the quota allows.
 * RETURNING reports the value this statement itself wrote.
 */
export async function bumpUsage(actor: string, feature: string): Promise<number> {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const row = await sql().first<{ count: number }>(
    `INSERT INTO usage_counters (actor, feature, period, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(actor, feature, period) DO UPDATE SET count = count + 1
     RETURNING count`,
    [actor, feature, period]
  );
  return row?.count ?? 0;
}

export async function getUsage(actor: string, feature: string): Promise<number> {
  const period = new Date().toISOString().slice(0, 7);
  const row = await sql().first<{ count: number }>(
    "SELECT count FROM usage_counters WHERE actor=? AND feature=? AND period=?",
    [actor, feature, period]
  );
  return row?.count ?? 0;
}
