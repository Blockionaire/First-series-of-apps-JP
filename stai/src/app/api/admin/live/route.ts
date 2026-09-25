import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { liveVisitors } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * Live visitor count, polled by the tile on Growth.
 *
 * Admin-only, like every other back-office endpoint. `no-store` matters more
 * here than elsewhere: a cached "live" number is not a stale number, it is a
 * wrong one.
 */
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return NextResponse.json(await liveVisitors(), {
    headers: { "Cache-Control": "no-store" },
  });
}
