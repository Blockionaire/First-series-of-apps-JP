import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { guard, WINDOW } from "@/lib/ratelimit";
import { DiscoveryBusyError, runDiscovery } from "@/lib/newsroom/discovery";

export const dynamic = "force-dynamic";

/**
 * "Run discovery now."
 *
 * One caller: an admin in the Editorial Inbox, with a session. The scheduled
 * run does NOT come through here — it calls the discovery service directly
 * from the Worker's `scheduled()` handler, so there is no publicly reachable
 * endpoint that starts a crawl and no shared secret to manage.
 *
 * That matters more than it looks. An unauthenticated endpoint which makes
 * dozens of outbound requests is an amplifier pointed at other people's
 * servers, including the regulators whose goodwill this desk depends on. The
 * safest version of that endpoint is the one that does not exist.
 *
 * Rate-limited even for admins: the button is next to a list, and a run makes
 * one request per due source.
 *
 * GET is not implemented on purpose. A crawler following a link must not be
 * able to start a crawl of its own.
 */
export async function POST(req: NextRequest) {
  const blocked = await guard(req, "newsroom-discover", 60, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // `force` skips the per-source cadence, so an operator who has just approved
  // a source is not told to come back in half an hour. It never skips
  // activation or retrieval permission — those are checked in shouldFetch and
  // have no override.
  const force = body?.force === true;

  try {
    const result = await runDiscovery({ force });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // One run at a time: the cron or another click already holds the lease.
    // Nothing was started, so there is nothing to record.
    if (e instanceof DiscoveryBusyError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    // The run records its own failure before rethrowing, so the Inbox shows a
    // failed run rather than a gap.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "discovery failed" },
      { status: 500 }
    );
  }
}
