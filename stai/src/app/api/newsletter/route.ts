import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql";
import { guard, WINDOW } from "@/lib/ratelimit";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "newsletter", 5, WINDOW.hour);
  if (blocked) return blocked;

  const { email, source } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const addr = email.toLowerCase().trim();
  const existing = await sql().first("SELECT 1 AS ok FROM newsletter WHERE email=?", [addr]);
  await sql().run(
    "INSERT INTO newsletter (email, source) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET source=excluded.source",
    [addr, String(source ?? "site")]
  );

  // Only greet a genuinely new subscriber. Re-posting the form must never
  // become a way to mail the same stranger repeatedly.
  if (existing) return NextResponse.json({ ok: true });

  await track("brief_waitlist", { path: "/", label: String(source ?? "site") });

  return NextResponse.json({ ok: true });
}
