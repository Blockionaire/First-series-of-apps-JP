import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { buildQuery, dataset, toCsv, type Row } from "@/lib/admin-datasets";

export const dynamic = "force-dynamic";

/**
 * The original early-access export, kept at its own URL because it is linked
 * from the Growth page and covered by a test that asserts it refuses
 * anonymous callers.
 *
 * The column list, the escaping and the formula-injection guard now come from
 * the shared registry rather than being spelled out again here — this file is
 * a stable address, not a second implementation.
 */
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const d = dataset("early-access");
  if (!d) return NextResponse.json({ error: "Unknown dataset" }, { status: 500 });

  const rows = (await sql().all(buildQuery(d))) as Row[];

  return new NextResponse(toCsv(d, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stai-early-access-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
