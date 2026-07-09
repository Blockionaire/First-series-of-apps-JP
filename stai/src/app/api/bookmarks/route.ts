import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { kind, refId } = await req.json().catch(() => ({}));
  if (!["article", "prompt"].includes(kind) || !Number.isInteger(refId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const d = db();
  const existing = d
    .prepare("SELECT 1 FROM bookmarks WHERE user_id=? AND kind=? AND ref_id=?")
    .get(user.id, kind, refId);
  if (existing) {
    d.prepare("DELETE FROM bookmarks WHERE user_id=? AND kind=? AND ref_id=?").run(user.id, kind, refId);
    return NextResponse.json({ saved: false });
  }
  d.prepare("INSERT INTO bookmarks (user_id, kind, ref_id) VALUES (?, ?, ?)").run(user.id, kind, refId);
  return NextResponse.json({ saved: true });
}
