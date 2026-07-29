import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "newsletter", 5, WINDOW.hour);
  if (blocked) return blocked;

  const { email, source } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const addr = email.toLowerCase().trim();
  const existing = db().prepare("SELECT 1 FROM newsletter WHERE email=?").get(addr);
  db()
    .prepare(
      "INSERT INTO newsletter (email, source) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET source=excluded.source"
    )
    .run(addr, String(source ?? "site"));

  // Only greet a genuinely new subscriber. Re-posting the form must never
  // become a way to mail the same stranger repeatedly.
  if (existing) return NextResponse.json({ ok: true });

  await sendMail(
    email,
    "You're on The STAI Brief",
    "Welcome to The STAI Brief.\n\nEvery Tuesday: the regulatory moves, standards signals and field intelligence that matter to European audit and finance — in four minutes.\n\nUntil then, the live desk is at https://stai.ai/briefing.\n\n— STAI"
  );

  return NextResponse.json({ ok: true });
}
