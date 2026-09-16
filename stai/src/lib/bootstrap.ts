import bcrypt from "bcryptjs";
import { sql } from "./sql";

/**
 * Create the editorial admin account, if credentials were supplied.
 *
 * This cannot live in seeds/*.sql: the password has to be hashed, and a seed
 * file is static SQL. It runs at startup instead, through the seam, so it
 * works identically on Node and on D1.
 *
 * NEVER SHIP A DEFAULT PASSWORD. Without explicit credentials no admin is
 * created at all: a live site with a documented fallback login is a handed-over
 * CMS. Bootstrap production by setting both variables once.
 *
 * Idempotent — ON CONFLICT DO NOTHING — so restarting never rewrites an
 * existing account, and in particular never resets a password that was
 * changed. Rotating the environment variable does not rotate the account;
 * that is deliberate, because the alternative is a deploy silently changing
 * who can log in.
 */
export async function ensureAdminAccount(): Promise<"created" | "exists" | "skipped"> {
  const email = process.env.STAI_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.STAI_ADMIN_PASSWORD;

  if (!email || !password || password.length < 12) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[STAI] No admin account: set STAI_ADMIN_EMAIL and STAI_ADMIN_PASSWORD (12+ chars) to bootstrap the content desk."
      );
    }
    return "skipped";
  }

  const existing = await sql().first("SELECT 1 AS ok FROM users WHERE email=?", [email]);
  if (existing) return "exists";

  await sql().run(
    `INSERT INTO users (email, password_hash, name, firm, role, plan)
     VALUES (?, ?, 'The Desk', 'STAI', 'admin', 'free')
     ON CONFLICT(email) DO NOTHING`,
    [email, bcrypt.hashSync(password, 10)]
  );
  return "created";
}
