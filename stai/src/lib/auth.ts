import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

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
  const info = db()
    .prepare("INSERT INTO users (email, password_hash, name, firm) VALUES (?, ?, ?, ?)")
    .run(email.toLowerCase().trim(), hash, name.trim(), firm.trim());
  return Number(info.lastInsertRowid);
}

export async function verifyUser(email: string, password: string): Promise<number | null> {
  const row = db()
    .prepare("SELECT id, password_hash FROM users WHERE email=?")
    .get(email.toLowerCase().trim()) as { id: number; password_hash: string } | undefined;
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  return ok ? row.id : null;
}

export async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expires.toISOString());
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
  if (token) db().prepare("DELETE FROM sessions WHERE token=?").run(token);
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id, u.email, u.name, u.firm, u.role, u.plan, u.founding
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token=? AND s.expires_at > datetime('now')`
    )
    .get(token) as (Omit<User, "plan" | "founding"> & { plan: string; founding: number }) | undefined;
  if (!row) return null;
  return { ...row, plan: row.plan === "plus" ? "plus" : "free", founding: !!row.founding };
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

/** Monthly usage metering, e.g. Ask STAI free-tier quota. Returns count AFTER increment. */
export function bumpUsage(actor: string, feature: string): number {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  db()
    .prepare(
      `INSERT INTO usage_counters (actor, feature, period, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(actor, feature, period) DO UPDATE SET count = count + 1`
    )
    .run(actor, feature, period);
  const row = db()
    .prepare("SELECT count FROM usage_counters WHERE actor=? AND feature=? AND period=?")
    .get(actor, feature, period) as { count: number };
  return row.count;
}

export function getUsage(actor: string, feature: string): number {
  const period = new Date().toISOString().slice(0, 7);
  const row = db()
    .prepare("SELECT count FROM usage_counters WHERE actor=? AND feature=? AND period=?")
    .get(actor, feature, period) as { count: number } | undefined;
  return row?.count ?? 0;
}
