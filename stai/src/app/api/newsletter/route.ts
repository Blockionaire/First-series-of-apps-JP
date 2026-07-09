import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  const { email, source } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  db()
    .prepare(
      "INSERT INTO newsletter (email, source) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET source=excluded.source"
    )
    .run(email.toLowerCase().trim(), String(source ?? "site"));

  await sendMail(
    email,
    "You're on The STAI Brief",
    "Welcome to The STAI Brief.\n\nEvery Tuesday: the regulatory moves, standards signals and field intelligence that matter to European audit and finance — in four minutes.\n\nUntil then, the live desk is at https://stai.ai/briefing.\n\n— STAI"
  );

  return NextResponse.json({ ok: true });
}
