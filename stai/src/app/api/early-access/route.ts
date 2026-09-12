import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard, WINDOW } from "@/lib/ratelimit";
import { isInterest } from "@/lib/earlyaccess";
import { track } from "@/lib/analytics";

/**
 * STAI+ early-access registration.
 *
 * Records interest only. No payment, no account required, and — because no
 * mail transport is configured for launch — no confirmation email is sent and
 * none is promised. The UI says so explicitly.
 */
export async function POST(req: NextRequest) {
  const blocked = guard(req, "early-access", 10, WINDOW.hour);
  if (blocked) return blocked;

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  const name = String(b.name ?? "").trim().slice(0, 120);
  const firm = String(b.firm ?? "").trim().slice(0, 200);
  const role = String(b.role ?? "").trim().slice(0, 80);
  const note = String(b.note ?? "").trim().slice(0, 500);
  const interests = Array.isArray(b.interests)
    ? b.interests.map(String).filter(isInterest).slice(0, 10)
    : [];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  // Re-registering updates the answers rather than erroring: someone returning
  // to add what they'd pay for should not be told they already exist.
  const existing = db().prepare("SELECT id FROM early_access WHERE email=?").get(email) as
    | { id: number }
    | undefined;

  db()
    .prepare(
      `INSERT INTO early_access (email, name, firm, role, interests, note, source)
       VALUES (@email, @name, @firm, @role, @interests, @note, @source)
       ON CONFLICT(email) DO UPDATE SET
         name=excluded.name, firm=excluded.firm, role=excluded.role,
         interests=excluded.interests, note=excluded.note`
    )
    .run({
      email,
      name,
      firm,
      role,
      interests: JSON.stringify(interests),
      note,
      source: String(b.source ?? "plus").slice(0, 40),
    });

  if (!existing) track("early_access", { path: "/plus", label: role || "unspecified" });

  return NextResponse.json({ ok: true, updated: !!existing });
}
