import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { foundingStatus } from "@/lib/content";
import { FIRM_INTERESTS } from "@/lib/firms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "The desk — admin",
  description: "STAI back office.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminPage() {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin");

  const d = db();
  const count = (sql: string) => (d.prepare(sql).get() as { n: number }).n;
  const stats = [
    { label: "Members (STAI+)", n: count("SELECT COUNT(*) n FROM users WHERE plan='plus'") },
    { label: "Free accounts", n: count("SELECT COUNT(*) n FROM users WHERE plan='free'") },
    { label: "Brief subscribers", n: count("SELECT COUNT(*) n FROM newsletter") },
    { label: "Training enquiries", n: count("SELECT COUNT(*) n FROM enquiries") },
    { label: "Assessments run", n: count("SELECT COUNT(*) n FROM assessments") },
    { label: "Published articles", n: count("SELECT COUNT(*) n FROM articles WHERE status='published'") },
  ];
  const founding = foundingStatus();

  const enquiries = d
    .prepare("SELECT id, name, email, firm, programme, seats, status, created_at FROM enquiries ORDER BY id DESC LIMIT 12")
    .all() as { id: number; name: string; email: string; firm: string; programme: string; seats: string; status: string; created_at: string }[];

  const firmEnquiries = d
    .prepare(
      "SELECT id, name, email, firm, role, firm_size, jurisdiction, interests, seats, created_at FROM firm_enquiries ORDER BY id DESC LIMIT 12"
    )
    .all() as {
    id: number;
    name: string;
    email: string;
    firm: string;
    role: string;
    firm_size: string;
    jurisdiction: string;
    interests: string;
    seats: string;
    created_at: string;
  }[];

  // The demand signal: what firms actually ask for decides build order.
  const allInterests = (
    d.prepare("SELECT interests FROM firm_enquiries").all() as { interests: string }[]
  ).flatMap((r) => {
    try {
      return JSON.parse(r.interests) as string[];
    } catch {
      return [];
    }
  });
  const demand = FIRM_INTERESTS.map((i) => ({
    label: i.label,
    available: i.available,
    count: allInterests.filter((x) => x === i.id).length,
  })).sort((a, b) => b.count - a.count);
  const demandTotal = allInterests.length;

  const outbox = d
    .prepare("SELECT id, to_email, subject, created_at, sent_at FROM outbox ORDER BY id DESC LIMIT 12")
    .all() as { id: number; to_email: string; subject: string; created_at: string; sent_at: string | null }[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Back office
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">The desk</h1>
        </div>
        <Link href="/admin/content" className="btn btn-primary">
          Content editor
        </Link>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="border p-4 rule">
            <p className="f-mono text-3xl font-bold tabular-nums text-cream-100">{s.n}</p>
            <p className="f-label mt-1" style={{ color: "var(--ink-faint)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </section>

      <p className="f-mono mt-4 text-[0.72rem] tracking-[0.04em]" style={{ color: "var(--ink-muted)" }}>
        Founding seats: <span className="text-cream-100">{founding.claimed}</span> claimed ·{" "}
        <span className="text-cream-100">{founding.remaining}</span> remaining of {founding.total}
      </p>

      {/* ——— Demand signal: what to build next ——— */}
      <section className="mt-10">
        <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Firm demand — what to build next {demandTotal > 0 && `(${demandTotal} signals)`}
        </h2>
        {demandTotal === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
            No firm enquiries yet. Once they arrive, this ranks what firms actually asked for — build in that
            order rather than guessing.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {demand.map((x) => (
              <li key={x.label} className="flex items-center gap-4">
                <span className="w-56 shrink-0 text-sm text-cream-200">
                  {x.label}
                  {!x.available && (
                    <span className="f-mono ml-2 text-[0.55rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
                      not built
                    </span>
                  )}
                </span>
                <span className="h-[10px] flex-1 border rule">
                  <span
                    className="block h-full bg-cream-400"
                    style={{ width: `${demandTotal ? (x.count / Math.max(...demand.map((y) => y.count), 1)) * 100 : 0}%` }}
                  />
                </span>
                <span className="f-mono w-8 shrink-0 text-right text-[0.75rem] tabular-nums text-cream-100">
                  {x.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Firm enquiries
        </h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="f-label text-left" style={{ color: "var(--ink-faint)" }}>
                <th className="py-2 pr-4">Ref</th>
                <th className="py-2 pr-4">Firm</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4">Wants</th>
                <th className="py-2">Logged</th>
              </tr>
            </thead>
            <tbody>
              {firmEnquiries.map((e) => {
                let wants: string[] = [];
                try {
                  wants = JSON.parse(e.interests);
                } catch {}
                return (
                  <tr key={e.id} className="border-t rule align-top">
                    <td className="f-mono py-2.5 pr-4 text-[0.72rem] text-cream-400">
                      STAI-FRM-{String(e.id).padStart(4, "0")}
                    </td>
                    <td className="py-2.5 pr-4 text-cream-200">
                      {e.firm}
                      <span className="f-mono block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                        {[e.firm_size, e.jurisdiction].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--ink-muted)" }}>
                      {e.name}
                      <span className="f-mono block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                        {e.email}
                        {e.role ? ` · ${e.role}` : ""}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
                      {wants.map((w) => FIRM_INTERESTS.find((i) => i.id === w)?.label ?? w).join(", ") || "—"}
                      {e.seats && (
                        <span className="f-mono block text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                          {e.seats}
                        </span>
                      )}
                    </td>
                    <td className="f-mono py-2.5 text-[0.7rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                      {e.created_at.slice(0, 16)}
                    </td>
                  </tr>
                );
              })}
              {firmEnquiries.length === 0 && (
                <tr className="border-t rule">
                  <td colSpan={5} className="py-4" style={{ color: "var(--ink-muted)" }}>
                    None yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Training enquiries
        </h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="f-label text-left" style={{ color: "var(--ink-faint)" }}>
                <th className="py-2 pr-4">Ref</th>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">Firm</th>
                <th className="py-2 pr-4">Programme</th>
                <th className="py-2 pr-4">Seats</th>
                <th className="py-2">Logged</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((e) => (
                <tr key={e.id} className="border-t rule align-top">
                  <td className="f-mono py-2.5 pr-4 text-[0.72rem] text-cream-400">STAI-TRN-{String(e.id).padStart(4, "0")}</td>
                  <td className="py-2.5 pr-4 text-cream-200">
                    {e.name}
                    <span className="f-mono block text-[0.65rem]" style={{ color: "var(--ink-faint)" }}>
                      {e.email}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4" style={{ color: "var(--ink-muted)" }}>{e.firm}</td>
                  <td className="py-2.5 pr-4" style={{ color: "var(--ink-muted)" }}>{e.programme}</td>
                  <td className="py-2.5 pr-4" style={{ color: "var(--ink-muted)" }}>{e.seats || "—"}</td>
                  <td className="f-mono py-2.5 text-[0.7rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>{e.created_at.slice(0, 16)}</td>
                </tr>
              ))}
              {enquiries.length === 0 && (
                <tr className="border-t rule">
                  <td colSpan={6} className="py-4" style={{ color: "var(--ink-muted)" }}>
                    None yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Mail outbox {process.env.RESEND_API_KEY ? "(relaying via Resend)" : "(no transport configured — everything is retained here)"}
        </h2>
        <ul className="mt-2">
          {outbox.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t py-2.5 rule">
              <span className={`f-mono text-[0.62rem] tracking-[0.1em] uppercase ${m.sent_at ? "text-signal-up" : "text-cream-400"}`}>
                {m.sent_at ? "SENT" : "QUEUED"}
              </span>
              <span className="f-mono text-[0.72rem] text-cream-400">{m.to_email}</span>
              <span className="text-sm text-cream-200">{m.subject}</span>
              <span className="f-mono ml-auto text-[0.65rem] tabular-nums" style={{ color: "var(--ink-faint)" }}>
                {m.created_at.slice(0, 16)}
              </span>
            </li>
          ))}
          {outbox.length === 0 && (
            <li className="border-t py-4 text-sm rule" style={{ color: "var(--ink-muted)" }}>
              Empty.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
