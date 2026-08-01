import { NextRequest, NextResponse } from "next/server";
import { verifyUser, startSession } from "@/lib/auth";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "login", 10, WINDOW.tenMinutes);
  if (blocked) return blocked;

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim();
  const password = String(b.password ?? "");
  const userId = await verifyUser(email, password);
  if (!userId) {
    return NextResponse.json({ error: "Email or password didn't match" }, { status: 401 });
  }
  await startSession(userId);
  return NextResponse.json({ ok: true });
}
