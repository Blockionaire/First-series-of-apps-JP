import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "bookmarks", 120, WINDOW.tenMinutes);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { kind, refId } = await req.json().catch(() => ({}));
  if (!["article", "prompt"].includes(kind) || !Number.isInteger(refId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const s = sql();
  const existing = await s.first("SELECT 1 AS ok FROM bookmarks WHERE user_id=? AND kind=? AND ref_id=?", [
    user.id,
    kind,
    refId,
  ]);
  if (existing) {
    await s.run("DELETE FROM bookmarks WHERE user_id=? AND kind=? AND ref_id=?", [user.id, kind, refId]);
    return NextResponse.json({ saved: false });
  }
  await s.run("INSERT INTO bookmarks (user_id, kind, ref_id) VALUES (?, ?, ?)", [user.id, kind, refId]);
  return NextResponse.json({ saved: true });
}
