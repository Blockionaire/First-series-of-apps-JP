import path from "path";

/**
 * Deployment configuration.
 *
 * Two values must be explicit in production rather than inferred, because
 * inferring them is exactly how the two worst bugs in this codebase happened:
 * the database path was inferred from process.cwd() (data written outside the
 * volume), and redirect URLs were inferred from the request Origin header
 * (attacker-controlled).
 */

/**
 * Where ALL persistent application state lives: stai.db plus its -wal and
 * -shm sidecars. In Docker this is the mounted volume (/data); in development
 * it defaults to <project>/data.
 */
export function dataDir(): string {
  return process.env.STAI_DATA_DIR || path.join(process.cwd(), "data");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Absolute public origin, e.g. https://stai.ai — no trailing slash.
 *
 * Mandatory in production. Throws rather than guessing: a wrong value here
 * sends users somewhere unexpected after payment, so failing loudly at the
 * first request beats silently redirecting to localhost or to whatever the
 * caller put in the Origin header.
 *
 * Called at request time, never at module load, so a missing value cannot
 * break `next build`.
 */
export function requireAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    if (isProduction()) {
      throw new Error("APP_URL is required in production (e.g. https://stai.ai)");
    }
    return "http://localhost:3000";
  }
  return raw.replace(/\/+$/, "");
}

/**
 * Non-throwing variant for metadata/canonical URLs, which are not a security
 * boundary and must not be able to fail a build.
 */
export function publicUrl(): string {
  return (process.env.APP_URL?.trim() || "https://stai.ai").replace(/\/+$/, "");
}

/**
 * Real card payments are possible only with a Stripe secret key. In
 * production there is NO fallback: the sandbox activation path is compiled
 * out of reach, so checkout is simply unavailable until the key is set.
 */
export function checkoutAvailable(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Sandbox checkout is a development affordance and must never exist in production. */
export function sandboxCheckoutAllowed(): boolean {
  return !isProduction() && !process.env.STRIPE_SECRET_KEY;
}
