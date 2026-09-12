import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "enquiry", 5, WINDOW.hour);
  if (blocked) return blocked;

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const firm = String(b.firm ?? "").trim().slice(0, 200);
  const programme = String(b.programme ?? "").trim().slice(0, 80);
  const seats = String(b.seats ?? "").trim().slice(0, 80);
  const message = String(b.message ?? "").trim().slice(0, 3000);

  if (!name || !firm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Name, firm and a valid email are required" }, { status: 400 });
  }

  const info = db()
    .prepare("INSERT INTO enquiries (name, email, firm, programme, seats, message) VALUES (?, ?, ?, ?, ?, ?)")
    .run(name, email, firm, programme, seats, message);
  const ref = `STAI-TRN-${String(info.lastInsertRowid).padStart(4, "0")}`;

  // Two mails through the outbox: one to the desk, one confirmation. Neither can be lost.
  await sendMail(
    process.env.TRAINING_INBOX ?? "training@stai.ai",
    `[${ref}] Training enquiry — ${firm} — ${programme}`,
    `Name: ${name}\nEmail: ${email}\nFirm: ${firm}\nProgramme: ${programme}\nParticipants: ${seats || "—"}\n\n${message || "(no message)"}`
  );
  await sendMail(
    email,
    `Your STAI training enquiry — ${ref}`,
    `Hi ${name.split(" ")[0]},\n\nYour enquiry for ${programme} is logged as ${ref}. We reply within one working day with dates and a proposal.\n\nEarly-bird pricing (25% off, ends 31 August 2026) is locked from the moment this enquiry was logged.\n\n— The STAI training desk`
  );

  return NextResponse.json({ ok: true, ref });
}
