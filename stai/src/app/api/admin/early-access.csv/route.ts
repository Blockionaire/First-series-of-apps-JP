import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { interestLabel } from "@/lib/earlyaccess";

export const dynamic = "force-dynamic";

/** Escapes a CSV field, including the leading-character guard against formula injection. */
function cell(v: string): string {
  const s = String(v ?? "");
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const rows = db()
    .prepare(
      "SELECT created_at, email, name, firm, role, interests, note FROM early_access ORDER BY id DESC"
    )
    .all() as {
    created_at: string;
    email: string;
    name: string;
    firm: string;
    role: string;
    interests: string;
    note: string;
  }[];

  const header = ["joined", "email", "name", "firm", "role", "interests", "note"].join(",");
  const body = rows
    .map((r) => {
      let wants: string[] = [];
      try {
        wants = JSON.parse(r.interests);
      } catch {}
      return [r.created_at, r.email, r.name, r.firm, r.role, wants.map(interestLabel).join("; "), r.note]
        .map(cell)
        .join(",");
    })
    .join("\n");

  return new NextResponse(`${header}\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stai-early-access-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
