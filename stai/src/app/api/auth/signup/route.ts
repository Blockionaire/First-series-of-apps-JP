import { NextRequest, NextResponse } from "next/server";
import { createUser, startSession } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "signup", 5, WINDOW.hour);
  if (blocked) return blocked;

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const name = String(b.name ?? "").trim().slice(0, 120);
  const firm = String(b.firm ?? "").trim().slice(0, 200);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password needs at least 8 characters" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Tell us your name" }, { status: 400 });
  }

  try {
    const id = await createUser(email, password, name, firm);
    await startSession(id);
    await sendMail(
      email,
      "Welcome to STAI",
      `Hi ${name.split(" ")[0]},\n\nYour STAI account is live: most briefings, the free slice of the prompt library, the AI-readiness assessment, and ${5} Ask STAI questions a month.\n\nThe full desk — every briefing, the complete prompt library with adapt-with-AI, unlimited Ask STAI — is STAI+: https://stai.ai/plus\n\n— STAI`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) {
      return NextResponse.json({ error: "That email already has an account — sign in instead" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }
}
