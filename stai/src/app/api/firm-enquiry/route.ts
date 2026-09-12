import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { guard, WINDOW } from "@/lib/ratelimit";
import { FIRM_INTERESTS, interestLabel } from "@/lib/firms";

const VALID_INTERESTS = new Set(FIRM_INTERESTS.map((i) => i.id));

export async function POST(req: NextRequest) {
  const blocked = guard(req, "firm-enquiry", 5, WINDOW.hour);
  if (blocked) return blocked;

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const firm = String(b.firm ?? "").trim().slice(0, 200);
  const role = String(b.role ?? "").trim().slice(0, 80);
  const firmSize = String(b.firmSize ?? "").trim().slice(0, 60);
  const jurisdiction = String(b.jurisdiction ?? "").trim().slice(0, 60);
  const seats = String(b.seats ?? "").trim().slice(0, 120);
  const message = String(b.message ?? "").trim().slice(0, 3000);
  const interests = Array.isArray(b.interests)
    ? b.interests.map(String).filter((i: string) => VALID_INTERESTS.has(i)).slice(0, 10)
    : [];

  if (!name || !firm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Name, firm and a valid work email are required" }, { status: 400 });
  }

  const info = db()
    .prepare(
      `INSERT INTO firm_enquiries (name, email, firm, role, firm_size, jurisdiction, interests, seats, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, email, firm, role, firmSize, jurisdiction, JSON.stringify(interests), seats, message);
  const ref = `STAI-FRM-${String(info.lastInsertRowid).padStart(4, "0")}`;

  const wanted = interests.map(interestLabel).join(", ") || "(none selected)";

  await sendMail(
    process.env.FIRMS_INBOX ?? process.env.TRAINING_INBOX ?? "firms@stai.ai",
    `[${ref}] Firm enquiry — ${firm}${firmSize ? ` (${firmSize})` : ""}`,
    `Firm: ${firm}\nSize: ${firmSize || "—"}\nJurisdiction: ${jurisdiction || "—"}\n\nContact: ${name} (${role || "role not given"})\nEmail: ${email}\nSeats: ${seats || "—"}\n\nInterested in: ${wanted}\n\n${message || "(no message)"}`
  );
  await sendMail(
    email,
    `Your STAI enquiry — ${ref}`,
    `Hi ${name.split(" ")[0]},\n\nThanks — your enquiry for ${firm} is logged as ${ref}.\n\nYou asked about: ${wanted}\n\nA founder will reply within one working day with straight answers on what's available today and what timeline the rest is on. We won't put you in a sales sequence.\n\n— STAI`
  );

  return NextResponse.json({ ok: true, ref });
}
