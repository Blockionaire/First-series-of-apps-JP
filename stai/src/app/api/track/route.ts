import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { track, isEventKind, pruneOldEvents } from "@/lib/analytics";
import { isTrackablePath } from "@/lib/analytics-paths";
import { guard, WINDOW } from "@/lib/ratelimit";

/**
 * Analytics beacon.
 *
 * Accepts only a fixed set of event kinds and a path. Nothing identifying is
 * read from the request: no IP, no user agent, no referrer. The visitor token
 * is a random value in a session cookie so we can count browsers rather than
 * hits; it dies with the browser session.
 */
export async function POST(req: NextRequest) {
  // Generous: a real reader triggers one per page view.
  const blocked = await guard(req, "track", 120, WINDOW.tenMinutes);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  if (!isEventKind(kind)) return NextResponse.json({ ok: false }, { status: 400 });
  // Only first-party paths, never a full URL.
  const path = String(body.path ?? "").slice(0, 300);
  if (path && !path.startsWith("/")) return NextResponse.json({ ok: false }, { status: 400 });

  // The back office does not count. Above the cookie block on purpose: a
  // request that will not be recorded should not mint an identifier either.
  //
  // 200 rather than 400 — the caller did nothing wrong, and browsers holding
  // a cached copy of the old beacon will keep sending these for a while.
  if (!isTrackablePath(path)) return NextResponse.json({ ok: true, recorded: false });

  const jar = await cookies();
  let visitor = jar.get("stai_v")?.value;
  if (!visitor) {
    visitor = crypto.randomBytes(8).toString("hex");
    jar.set("stai_v", visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Session cookie: no maxAge, so it expires when the browser closes.
    });
  }

  await track(kind, { path, label: String(body.label ?? "").slice(0, 200), visitor });

  // Cheap opportunistic retention sweep, roughly once per thousand events.
  if (Math.random() < 0.001) await pruneOldEvents();

  return NextResponse.json({ ok: true });
}
