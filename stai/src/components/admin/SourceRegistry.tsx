"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type RegistryRow = {
  id: number;
  name: string;
  domain: string;
  tier: number;
  type: string;
  jurisdictions: string[];
  ingestion: string;
  feedUrl: string;
  frequency: number;
  fetchAllowed: boolean;
  active: boolean;
  activatedBy: string | null;
  licenseNotes: string;
  retention: string;
  health: string;
  healthDetail: string;
};

type Props = {
  sources: RegistryRow[];
  proposedCount: number;
  alreadyLoaded: boolean;
};

/**
 * The approval surface.
 *
 * One row, two independent switches, and no bulk activate anywhere. Loading
 * the proposal inserts dormant rows; turning one on is a separate, deliberate
 * act that records who did it.
 *
 * The absence of a "select all" is the feature. Fifty sources approved in one
 * click is fifty sources nobody read, and the registry's whole purpose is that
 * somebody read them.
 */
export default function SourceRegistry({ sources, proposedCount, alreadyLoaded }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | "load" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/newsroom/source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  }

  async function loadProposal() {
    setBusy("load");
    setError("");
    setMessage("");
    try {
      const json = await post({ action: "load_proposal" });
      setMessage(
        `${json.inserted} source${json.inserted === 1 ? "" : "s"} registered, all inactive. ` +
          `Activate them individually below.`
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the proposal");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(id: number, field: "active" | "fetch_allowed", value: boolean) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await post({ action: "set_flag", id, field, value });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the source");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8">
      {!alreadyLoaded && (
        <div className="border p-5 rule">
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            The registry is empty. Loading the proposal registers {proposedCount} publications as{" "}
            <span className="text-cream-200">inactive</span> rows. Nothing is fetched, no crawl
            starts, and every source stays off until you switch it on here.
          </p>
          <button
            type="button"
            onClick={loadProposal}
            disabled={busy === "load"}
            className="btn btn-primary btn-sm mt-4"
          >
            {busy === "load" ? "Loading…" : `Register ${proposedCount} proposed sources (inactive)`}
          </button>
        </div>
      )}

      {message && (
        <p className="f-mono mt-4 text-[0.75rem] text-gold-300">{message}</p>
      )}
      {error && (
        <p className="f-mono mt-4 text-[0.75rem]" style={{ color: "var(--danger, #d88)" }}>
          {error}
        </p>
      )}

      {sources.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-[0.82rem]">
            <thead>
              <tr className="f-label border-b rule" style={{ color: "var(--ink-faint)" }}>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Tier</th>
                <th className="py-2 pr-4">Jurisdiction</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Every</th>
                <th className="py-2 pr-4">Retrievable</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2">Health</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b rule align-top">
                  <td className="py-2 pr-4">
                    <span className="text-cream-200">{s.name}</span>
                    <span className="f-mono block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                      {s.domain} · {s.type} · keeps {s.retention.replace(/_/g, " ")}
                    </span>
                    {s.licenseNotes && (
                      <span className="mt-1 block text-[0.72rem] text-gold-300">{s.licenseNotes}</span>
                    )}
                  </td>
                  <td className="f-mono py-2 pr-4 tabular-nums text-cream-400">{s.tier}</td>
                  <td className="py-2 pr-4 text-cream-400">{s.jurisdictions.join(", ")}</td>
                  <td className="f-mono py-2 pr-4 text-[0.72rem] text-cream-400">{s.ingestion}</td>
                  <td className="f-mono py-2 pr-4 tabular-nums text-cream-400">{s.frequency}m</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => toggle(s.id, "fetch_allowed", !s.fetchAllowed)}
                      disabled={busy === s.id}
                      className="btn btn-ghost btn-sm"
                    >
                      {s.fetchAllowed ? "Permitted" : "Unchecked"}
                    </button>
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => toggle(s.id, "active", !s.active)}
                      disabled={busy === s.id}
                      className={s.active ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                    >
                      {s.active ? "On" : "Off"}
                    </button>
                    {s.active && s.activatedBy && (
                      <span className="f-mono block text-[0.65rem]" style={{ color: "var(--ink-faint)" }}>
                        by {s.activatedBy}
                      </span>
                    )}
                  </td>
                  <td className="f-mono py-2 text-[0.72rem] text-cream-400">
                    {s.active ? (
                      <>
                        {s.health}
                        {s.healthDetail && (
                          <span className="block" style={{ color: "var(--ink-faint)" }}>
                            {s.healthDetail}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: "var(--ink-faint)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
