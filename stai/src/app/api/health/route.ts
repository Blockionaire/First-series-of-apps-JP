import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Container healthcheck. Cheap, unauthenticated, and deliberately mute about
 * configuration: it proves the process is up and the database on the mounted
 * volume is readable, and reveals nothing else.
 */
export async function GET() {
  try {
    const row = db().prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number };
    return NextResponse.json(
      { status: "ok", db: "ok", articles: row.n },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "error", db: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
