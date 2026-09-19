import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { buildQuery, dataset, filterFor, toCsv, type Row } from "@/lib/admin-datasets";

export const dynamic = "force-dynamic";

/**
 * CSV export for any dataset in the admin registry.
 *
 * The dataset name arrives in the URL, which would be alarming if it reached a
 * query — it does not. `dataset()` matches it against the registry by exact
 * id and an unknown name 404s before any database work happens, so the only
 * SQL that can run is the text written in lib/admin-datasets.ts. Same for the
 * `?plan=` filter.
 *
 * Admin-only, and checked before the 404 so this cannot be used to probe which
 * datasets exist.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ dataset: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { dataset: id } = await ctx.params;
  const d = dataset(id);
  if (!d) return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });

  const filter = filterFor(d, req.nextUrl.searchParams.get(d.filters?.param ?? "") ?? undefined);
  const rows = (await sql().all(buildQuery(d, filter))) as Row[];

  const suffix = filter && filter.where ? `-${filter.id}` : "";
  const name = `stai-${d.id}${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(toCsv(d, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
