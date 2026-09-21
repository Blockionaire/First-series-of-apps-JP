import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { runDiscovery } from "@/lib/newsroom/discovery";

export const dynamic = "force-dynamic";

/**
 * Run discovery.
 *
 * Two callers, two ways in, and the route refuses everything else:
 *
 *   · Cloudflare Cron, via the Worker's `scheduled()` handler, which presents
 *     `NEWSROOM_CRON_SECRET` in a header. Cron triggers cannot carry a session
 *     cookie, so a shared secret is the only mechanism available.
 *   · An admin pressing "Run discovery now" in the Editorial Inbox, with a
 *     normal session.
 *
 * ── Why the secret is required rather than optional ─────────────────────
 * An unauthenticated endpoint that makes dozens of outbound requests is a
 * free amplifier pointed at other people's servers — including regulators
 * whose goodwill this desk depends on. With no secret configured the cron
 * path is simply closed; it does not fall open.
 *
 * GET is not implemented on purpose. A crawler following a link must not be
 * able to start a crawl of its own.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.NEWSROOM_CRON_SECRET?.trim() ?? "";
  const presented = req.headers.get("x-newsroom-cron")?.trim() ?? "";

  // Length-independent comparison is overkill for a header nobody can time
  // remotely through a Worker, but the cost is one line.
  const viaCron = secret.length >= 16 && presented.length === secret.length && presented === secret;

  if (!viaCron) {
    const user = await currentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  // `force` skips the per-source cadence so an operator is not told to come
  // back in half an hour. It never skips activation or retrieval permission —
  // those are checked in shouldFetch and have no override.
  const force = body?.force === true && !viaCron;

  try {
    const result = await runDiscovery({ force });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // The run records its own failure before rethrowing, so the Inbox shows a
    // failed run rather than a gap.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "discovery failed" },
      { status: 500 }
    );
  }
}
