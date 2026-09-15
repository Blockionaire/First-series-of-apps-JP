import { NextResponse } from "next/server";
import { count } from "@/lib/sql";

export const dynamic = "force-dynamic";

/**
 * Container healthcheck. Cheap, unauthenticated, and deliberately mute about
 * configuration: it proves the process is up and the database on the mounted
 * volume is readable, and reveals nothing else.
 */
export async function GET() {
  try {
    const articles = await count("SELECT COUNT(*) AS n FROM articles");
    return NextResponse.json(
      { status: "ok", db: "ok", articles },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "error", db: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
