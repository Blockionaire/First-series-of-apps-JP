import type { OpStatus } from "@/lib/newsroom/source-health";

/**
 * The top of the Source Health dashboard: counts, per-tier health, one
 * stacked bar, and the short list of what to look at next.
 *
 * Server-rendered and read-only. Every number is derived from the same
 * assessment the table below shows, so the two cannot disagree.
 */

export type SummaryRow = {
  id: number;
  name: string;
  tier: number;
  status: OpStatus;
  group: number;
  reasons: string[];
  active: boolean;
  fetchAllowed: boolean;
};

export const STATUS_META: Record<OpStatus, { label: string; color: string; title: string }> = {
  broken: { label: "Broken", color: "var(--color-signal-down)", title: "Being fetched, and failing" },
  attention: { label: "Attention", color: "var(--color-gold-300)", title: "Working or waiting, but something needs a person" },
  unreviewed: { label: "Unreviewed", color: "var(--color-cream-400)", title: "Nobody has reviewed this source yet" },
  healthy: { label: "Healthy", color: "var(--color-signal-up)", title: "On, permitted, retrieving, reviewed and recently confirmed" },
  disabled: { label: "Disabled", color: "var(--color-navy-600)", title: "Switched off after review, or marked do not use" },
};

const ORDER: OpStatus[] = ["broken", "attention", "unreviewed", "healthy", "disabled"];

function Card({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="border p-3 rule">
      <p className="f-mono text-xl font-bold tabular-nums" style={{ color: tone ?? "var(--color-cream-100)" }}>
        {value}
      </p>
      <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
        {label}
      </p>
    </div>
  );
}

export default function SourceHealthSummary({ rows, queue }: { rows: SummaryRow[]; queue: SummaryRow[] }) {
  const count = (s: OpStatus) => rows.filter((r) => r.status === s).length;
  const total = rows.length;

  return (
    <section className="mt-8" aria-label="Source health">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card value={total} label="Total sources" />
        <Card value={count("healthy")} label="Healthy" tone={STATUS_META.healthy.color} />
        <Card value={count("attention")} label="Needs attention" tone={STATUS_META.attention.color} />
        <Card value={count("broken")} label="Broken" tone={STATUS_META.broken.color} />
        <Card value={count("unreviewed")} label="Unreviewed" />
        <Card value={rows.filter((r) => r.active).length} label="Active" />
        <Card value={rows.filter((r) => r.fetchAllowed).length} label="Retrieval permitted" />
      </div>

      {/* One bar, five segments. Widths are shares of all registered sources. */}
      {total > 0 && (
        <div className="mt-4">
          <div className="flex h-2.5 w-full overflow-hidden border rule" role="img" aria-label={ORDER.map((s) => `${count(s)} ${STATUS_META[s].label.toLowerCase()}`).join(", ")}>
            {ORDER.map((s) =>
              count(s) > 0 ? (
                <span
                  key={s}
                  title={`${count(s)} ${STATUS_META[s].label}`}
                  style={{ width: `${(count(s) / total) * 100}%`, background: STATUS_META[s].color }}
                />
              ) : null
            )}
          </div>
          <p className="f-mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
            {ORDER.map((s) => (
              <span key={s} title={STATUS_META[s].title}>
                <span className="mr-1 inline-block h-2 w-2 align-middle" style={{ background: STATUS_META[s].color }} />
                {STATUS_META[s].label} {count(s)}
              </span>
            ))}
            <span className="ml-auto">
              {([1, 2, 3] as const).map((t, i) => {
                const inTier = rows.filter((r) => r.tier === t);
                return (
                  <span key={t}>
                    {i > 0 && " · "}Tier {t} healthy {inTier.filter((r) => r.status === "healthy").length}/{inTier.length}
                  </span>
                );
              })}
            </span>
          </p>
        </div>
      )}

      <div className="mt-6 border p-4 rule">
        <h2 className="f-label" style={{ color: "var(--ink-faint)" }}>
          Needs your attention
        </h2>
        {queue.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            Nothing is waiting on you.
          </p>
        ) : (
          <ol className="mt-2 space-y-1">
            {queue.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-[0.82rem]">
                <span className="f-mono w-5 text-right tabular-nums" style={{ color: "var(--ink-faint)" }}>
                  {i + 1}.
                </span>
                <a href={`#source-${r.id}`} className="text-cream-100 underline underline-offset-4 hover:text-cream-200">
                  {r.name}
                </a>
                <span className="f-mono text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
                  T{r.tier}
                </span>
                <span className="f-mono text-[0.68rem] font-bold uppercase tracking-[0.12em]" style={{ color: STATUS_META[r.status].color }}>
                  {STATUS_META[r.status].label}
                </span>
                <span style={{ color: "var(--ink-muted)" }}>— {r.reasons[0] ?? ""}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
