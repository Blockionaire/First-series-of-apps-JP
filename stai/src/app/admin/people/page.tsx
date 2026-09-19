import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { sql, count } from "@/lib/sql";
import {
  DATASETS,
  buildCountQuery,
  buildQuery,
  cellValue,
  dataset,
  filterFor,
  type Row,
} from "@/lib/admin-datasets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "The register — admin",
  description: "STAI back office.",
  path: "/admin/people",
  noIndex: true,
});

/**
 * Every list of people behind the desk's tiles.
 *
 * One page rather than six, because the shape is identical every time: a
 * table, a total, a download. The differences live in lib/admin-datasets.ts,
 * so adding a list later is a registry entry and no new page.
 *
 * Rows are capped at 200. The table is for looking; the CSV is for the whole
 * set, and the count line says which you are looking at rather than leaving
 * you to guess whether the list ended or was cut.
 */
const PAGE_ROWS = 200;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; plan?: string }>;
}) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/people");

  const params = await searchParams;
  const d = dataset(params.d) ?? DATASETS[0];
  const filter = filterFor(d, params.plan) ?? d.filters?.options[0];
  const activeFilter = filter?.where ? filter : undefined;

  const rows = (await sql().all(`${buildQuery(d, activeFilter)} LIMIT ${PAGE_ROWS}`)) as Row[];
  const total = await count(buildCountQuery(d, activeFilter));

  const href = (id: string, plan?: string) =>
    `/admin/people?d=${id}${plan && plan !== "all" ? `&plan=${plan}` : ""}`;
  const csvHref = activeFilter
    ? `/api/admin/export/${d.id}?${d.filters?.param}=${activeFilter.id}`
    : `/api/admin/export/${d.id}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Back office
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">The register</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/growth" className="btn btn-ghost btn-sm">
            Growth
          </Link>
          <Link href="/admin" className="btn btn-ghost btn-sm">
            The desk
          </Link>
        </div>
      </header>

      {/* Datasets */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Register">
        {DATASETS.map((x) => (
          <Link
            key={x.id}
            href={href(x.id)}
            aria-current={x.id === d.id ? "page" : undefined}
            className={`f-mono border px-3 py-1.5 text-[0.68rem] tracking-[0.12em] uppercase transition-colors ${
              x.id === d.id ? "border-cream-400 text-cream-100" : "rule text-cream-400 hover:text-cream-100"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {/* Filters, where a dataset has them */}
      {d.filters && (
        <nav className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filter">
          <span className="f-label mr-1" style={{ color: "var(--ink-faint)" }}>
            {d.filters.param}
          </span>
          {d.filters.options.map((o) => (
            <Link
              key={o.id}
              href={href(d.id, o.id)}
              aria-current={o.id === (filter?.id ?? "all") ? "true" : undefined}
              className={`f-mono px-2 py-1 text-[0.66rem] tracking-[0.1em] uppercase transition-colors ${
                o.id === (filter?.id ?? "all")
                  ? "text-cream-100 underline underline-offset-4"
                  : "text-cream-400 hover:text-cream-100"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </nav>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-2 rule-strong">
          <div>
            <h2 className="f-label" style={{ color: "var(--ink-faint)" }}>
              {d.label} ({total})
            </h2>
            <p className="mt-1 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
              {d.blurb}
            </p>
          </div>
          {total > 0 && (
            <a href={csvHref} className="f-label text-cream-400 hover:text-cream-100">
              Download CSV →
            </a>
          )}
        </div>

        {total === 0 ? (
          <p className="mt-4 text-sm" style={{ color: "var(--ink-muted)" }}>
            Nothing here yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="f-label text-left" style={{ color: "var(--ink-faint)" }}>
                    {d.columns.map((c) => (
                      <th key={c.key} className="py-2 pr-4">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={String(r.id ?? i)} className="border-t rule align-top">
                      {d.columns.map((c) => {
                        const v = cellValue(c, r);
                        return (
                          <td
                            key={c.key}
                            className={`py-2.5 pr-4 ${c.mono ? "f-mono text-[0.72rem] tabular-nums" : ""}`}
                            style={{ color: c.mono ? "var(--ink-faint)" : "var(--ink-muted)" }}
                          >
                            {v || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="f-mono mt-3 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
              {total > PAGE_ROWS
                ? `Showing the ${PAGE_ROWS} most recent of ${total}. The CSV has every row.`
                : `Showing all ${total}.`}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
