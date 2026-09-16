import { NextResponse } from "next/server";
import { count } from "@/lib/sql";
import { rateLimitScope, rateLimitDegradations } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Health check. Cheap, unauthenticated, and deliberately mute about
 * configuration.
 *
 * It answers three operational questions and nothing else:
 *   - is the application serving?
 *   - is the database reachable, and which one?
 *   - can the rate limiter still promise what it claims?
 *
 * What it does NOT expose: the D1 database id, account identifiers, binding
 * names beyond the driver label, environment variables, or whether any
 * particular secret is set. `driver` says "d1" or "sqlite" because that is the
 * single most useful fact when diagnosing a deploy, and it reveals nothing an
 * attacker could act on.
 *
 * The old `articles` count is kept — it is the cheapest end-to-end proof that
 * a query actually executed rather than a connection merely existing.
 */
export async function GET() {
  const runtime = process.env.STAI_RUNTIME === "workers" ? "workers" : "node";
  const driver = runtime === "workers" ? "d1" : "sqlite";

  try {
    const articles = await count("SELECT COUNT(*) AS n FROM articles WHERE status='published'");
    return NextResponse.json(
      {
        status: "ok",
        runtime,
        db: { driver, reachable: true, publishedArticles: articles },
        limiter: { scope: rateLimitScope(), degradations: rateLimitDegradations() },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    // A missing D1 binding, a database that has not been migrated, and a
    // genuine outage are all operationally different. The message is the
    // thrown one, which for a missing binding names the binding — useful
    // during a deploy, and not a secret.
    return NextResponse.json(
      {
        status: "error",
        runtime,
        db: { driver, reachable: false, error: e instanceof Error ? e.message : "unknown" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
