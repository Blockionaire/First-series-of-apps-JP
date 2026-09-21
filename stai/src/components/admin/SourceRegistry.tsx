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
  /* ── Fetch telemetry ──────────────────────────────────────────────────
   * What happened the LAST TIME WE TRIED, as distinct from when this last
   * worked. A source whose last attempt was a 404 four minutes ago and one
   * that simply has not been due for an hour are indistinguishable without
   * these, and they need opposite responses.
   */
  lastAttemptAt: string | null;
  lastOutcome: string;
  lastHttpStatus: number | null;
  lastError: string;
  lastItemsFound: number;
  lastItemsNew: number;
  consecutiveFailures: number;
};

type Props = {
  sources: RegistryRow[];
  proposedCount: number;
  alreadyLoaded: boolean;
};

/**
 * Is this safe to put in an href?
 *
 * `validateSource` already requires https for everything the engine fetches,
 * so in practice every stored feed URL passes. This guards the case it does
 * not cover: a row written straight to the database. Rendering an arbitrary
 * stored string as a link is how a `javascript:` URL becomes a click, and the
 * check costs one line.
 *
 * A URL that fails this is still SHOWN — seeing that a row holds something
 * unopenable is exactly the diagnosis an operator needs — just not linked.
 */
function linkable(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

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

  /**
   * Correcting a moved feed.
   *
   * Feed URLs move — the AFM's was the first to be caught, by clicking the
   * link this table shows. Without an edit here every correction is a code
   * change and a deploy, which is absurd for replacing one string and is how
   * broken feeds end up staying broken.
   */
  const [editing, setEditing] = useState<number | null>(null);
  const [draftUrl, setDraftUrl] = useState("");

  async function saveFeedUrl(id: number) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const json = await post({ action: "set_feed_url", id, feed_url: draftUrl });
      setEditing(null);
      setDraftUrl("");
      setMessage(
        `Feed URL updated to ${json.feed_url}. Retrieval permission was reset — re-check the new address before ticking Permitted.`
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the feed URL");
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

                    {/* The configured feed, in full and openable.
                        This is what has to be checked before a source is
                        marked retrievable, and the exact string matters: a
                        feed URL that 404s and one that serves a landing page
                        look identical from the health column alone. Shown
                        verbatim rather than shortened, and `break-all` so a
                        long query string wraps instead of widening the table. */}
                    {editing === s.id ? (
                      <span className="mt-2 block">
                        <input
                          type="url"
                          value={draftUrl}
                          onChange={(e) => setDraftUrl(e.target.value)}
                          placeholder="https://…"
                          className="f-mono w-full border bg-transparent px-2 py-1 text-[0.72rem] rule text-cream-100"
                        />
                        <span className="mt-1 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy === s.id || !draftUrl.trim()}
                            onClick={() => saveFeedUrl(s.id)}
                            className="btn btn-primary btn-sm"
                          >
                            {busy === s.id ? "Saving…" : "Save URL"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(null);
                              setDraftUrl("");
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            Cancel
                          </button>
                        </span>
                        <span
                          className="mt-1 block text-[0.68rem]"
                          style={{ color: "var(--ink-faint)" }}
                        >
                          Must be https and belong to {s.domain}. Saving resets Retrievable.
                        </span>
                      </span>
                    ) : s.feedUrl ? (
                      <span className="mt-1 block">
                        {linkable(s.feedUrl) ? (
                          <>
                            <a
                              href={s.feedUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="f-mono text-[0.7rem] break-all text-cream-400 underline underline-offset-4 hover:text-cream-100"
                            >
                              {s.feedUrl}
                            </a>{" "}
                            <a
                              href={s.feedUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="f-mono whitespace-nowrap text-[0.68rem] text-gold-300 hover:underline"
                            >
                              Open feed ↗
                            </a>{" "}
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(s.id);
                                setDraftUrl(s.feedUrl);
                              }}
                              className="f-mono whitespace-nowrap text-[0.68rem] text-cream-400 underline underline-offset-4 hover:text-cream-100"
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <span className="f-mono text-[0.7rem] break-all text-gold-300">
                            {s.feedUrl} — not an http(s) URL
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="f-mono mt-1 block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                        no feed — entered by hand
                      </span>
                    )}

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
                        <span className={s.health === "ok" ? "text-cream-400" : "text-gold-300"}>
                          {s.health}
                        </span>
                        {s.healthDetail && (
                          <span className="block" style={{ color: "var(--ink-faint)" }}>
                            {s.healthDetail}
                          </span>
                        )}
                        {/* The last ATTEMPT, which is a different question
                            from the last success and is usually the one being
                            asked when a feed looks quiet. */}
                        {s.lastAttemptAt && (
                          <span className="block" style={{ color: "var(--ink-faint)" }}>
                            {s.lastAttemptAt.slice(5, 16).replace("T", " ")} · {s.lastOutcome}
                            {s.lastHttpStatus ? ` ${s.lastHttpStatus}` : ""} · {s.lastItemsFound}{" "}
                            found, {s.lastItemsNew} new
                          </span>
                        )}
                        {s.lastError && (
                          <span className="block text-gold-300">{s.lastError.slice(0, 90)}</span>
                        )}
                        {s.consecutiveFailures > 0 && (
                          <span className="block text-gold-300">
                            {s.consecutiveFailures} consecutive failure
                            {s.consecutiveFailures === 1 ? "" : "s"}
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
