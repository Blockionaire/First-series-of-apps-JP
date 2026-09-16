import { NextResponse } from "next/server";
import { count } from "@/lib/sql";
import { rateLimitScope, rateLimitDegradations } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Container healthcheck. Cheap, unauthenticated, and deliberately mute about
 * configuration: it proves the process is up and the database on the mounted
 * volume is readable, and reveals nothing else.
 *
 * `limiter` is the one piece of internal state worth exposing. A rate limiter
 * that has quietly fallen back to per-isolate counting still returns 200 on
 * every request and looks perfectly healthy; naming its scope here is what
 * makes that visible instead of silent. It leaks nothing — an attacker learns
 * only that the site has a rate limiter, which they can infer by hitting it.
 */
export async function GET() {
  try {
    const articles = await count("SELECT COUNT(*) AS n FROM articles");
    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        articles,
        limiter: { scope: rateLimitScope(), degradations: rateLimitDegradations() },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "error", db: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
