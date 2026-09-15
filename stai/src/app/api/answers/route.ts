import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "answers", 60, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan !== "plus") return NextResponse.json({ error: "Saving answers is STAI+" }, { status: 403 });
  const { question, answer, sources } = await req.json().catch(() => ({}));
  if (typeof question !== "string" || typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await sql().run("INSERT INTO saved_answers (user_id, question, answer, sources) VALUES (?, ?, ?, ?)", [
    user.id,
    question.slice(0, 500),
    answer.slice(0, 8000),
    JSON.stringify(sources ?? []).slice(0, 4000),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  await sql().run("DELETE FROM saved_answers WHERE id=? AND user_id=?", [Number(id), user.id]);
  return NextResponse.json({ ok: true });
}
