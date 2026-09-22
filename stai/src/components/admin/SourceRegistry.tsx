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
  /* ── Human review (phase 2.5) ─────────────────────────────────────────
   * Where a person has got to with this source. Advisory — `fetchAllowed`
   * remains the permission — so these are shown next to the switches rather
   * than as one of them.
   */
  reviewStatus: string;
  reviewedBy: string;
  reviewedAt: string | null;
  reviewNote: string;
};

/** What the feed tester found. Mirrors `Probe` in lib/newsroom/probe.ts. */
export type ProbeResult = {
  ok: boolean;
  httpStatus: number | null;
  finalUrl: string;
  redirected: boolean;
  contentType: string;
  format: string;
  itemCount: number;
  latestPublishedAt: string | null;
  sampleTitles: string[];
  itemsWithoutDate: number;
  error: string;
  bytes: number;
  durationMs: number;
};

/**
 * The registry's word for what the prober detected.
 *
 * `parseFeed` says "json"; the registry's ingestion method is "json_api". One
 * mapping, so the mismatch warning compares like with like rather than telling
 * an operator to set a value the dropdown does not offer.
 */
function methodFor(format: string): string {
  return format === "json" ? "json_api" : format;
}

const REVIEW_OPTIONS: { id: string; label: string }[] = [
  { id: "unreviewed", label: "Unreviewed" },
  { id: "feed_verified", label: "Feed verified" },
  { id: "retrieval_approved", label: "Retrieval approved" },
  { id: "needs_fix", label: "Needs fix" },
  { id: "do_not_use", label: "Do not use" },
];

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
  const [draftMethod, setDraftMethod] = useState("");

  async function saveFeedUrl(id: number) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const json = await post({
        action: "set_feed_url",
        id,
        feed_url: draftUrl,
        ingestion_method: draftMethod,
      });
      setEditing(null);
      setDraftUrl("");
      setDraftMethod("");
      setMessage(
        `Feed URL updated to ${json.feed_url} (${json.ingestion_method}). Retrieval permission was reset — re-check the new address before ticking Permitted.`
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the feed URL");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Look before approving.
   *
   * The result is held in component state and never refreshes the page: an
   * operator comparing three candidate paths for one body needs the previous
   * answer still on screen while they try the next.
   */
  const [probes, setProbes] = useState<Record<number, ProbeResult & { url: string }>>({});
  const [testUrl, setTestUrl] = useState<Record<number, string>>({});

  async function testSource(id: number) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const json = await post({ action: "test_source", id, url: testUrl[id] ?? "" });
      setProbes((p) => ({ ...p, [id]: { ...json.probe, url: json.url } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not test that feed");
    } finally {
      setBusy(null);
    }
  }

  async function setReview(id: number, status: string) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await post({ action: "set_review", id, status });
      if (status === "do_not_use") {
        setMessage("Marked do not use — the source was switched off and retrieval withdrawn.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that review");
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
        <p className="f-mono mt-4 text-[0.75rem]" style={{ color: "var(--color-signal-down)" }}>
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
                <th className="py-2 pr-4">Review</th>
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
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {/* The method travels with the address. Finding a
                              real feed for a source registered as html_scrape
                              is the common case here, and saving the URL alone
                              would leave it skipped as unsupported. */}
                          <select
                            value={draftMethod}
                            onChange={(e) => setDraftMethod(e.target.value)}
                            className="input-stai-sm"
                          >
                            {["rss", "atom", "json_api", "html_scrape", "manual"].map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
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
                              setDraftMethod("");
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
                                setDraftMethod(s.ingestion);
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

                    {/* Test, and the candidate-URL box beside it.
                        Testing runs on a source that is off and unapproved
                        on purpose — deciding whether a URL is worth approving
                        is exactly what happens before approving it. The box
                        accepts a path to try without committing it; it must
                        still belong to this source's domain, which is what
                        keeps this a feed tester rather than an open fetcher. */}
                    <span className="mt-2 block">
                      <span className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busy === s.id}
                          onClick={() => testSource(s.id)}
                          className="btn btn-ghost btn-sm"
                        >
                          {busy === s.id ? "Testing…" : "Test source"}
                        </button>
                        <input
                          type="url"
                          value={testUrl[s.id] ?? ""}
                          onChange={(e) => setTestUrl((t) => ({ ...t, [s.id]: e.target.value }))}
                          placeholder={`try another path on ${s.domain}`}
                          className="f-mono min-w-0 flex-1 border bg-transparent px-2 py-1 text-[0.68rem] rule text-cream-100"
                        />
                      </span>

                      {probes[s.id] && (
                        <span
                          className="f-mono mt-2 block border p-2 text-[0.68rem] leading-relaxed rule"
                          style={{ color: "var(--ink-faint)" }}
                        >
                          <span
                            className={probes[s.id].ok ? "block text-cream-200" : "block text-gold-300"}
                          >
                            {probes[s.id].ok ? "feed ok" : "not usable"} ·{" "}
                            {probes[s.id].httpStatus ?? "no response"} · {probes[s.id].format} ·{" "}
                            {probes[s.id].itemCount} item
                            {probes[s.id].itemCount === 1 ? "" : "s"} · {probes[s.id].durationMs}ms
                          </span>
                          <span className="block break-all">tested {probes[s.id].url}</span>
                          {/* The final URL matters most when it differs: a feed
                              that 301s to a landing page reads as healthy
                              until you see where it ended up. */}
                          {probes[s.id].redirected && (
                            <span className="block break-all text-gold-300">
                              redirected to {probes[s.id].finalUrl}
                            </span>
                          )}
                          {probes[s.id].contentType && (
                            <span className="block">served as {probes[s.id].contentType}</span>
                          )}
                          {probes[s.id].latestPublishedAt ? (
                            <span className="block">
                              newest item {probes[s.id].latestPublishedAt!.slice(0, 16).replace("T", " ")}
                            </span>
                          ) : (
                            probes[s.id].itemCount > 0 && (
                              <span className="block text-gold-300">
                                no parseable dates — items would never rank as recent
                              </span>
                            )
                          )}
                          {probes[s.id].itemsWithoutDate > 0 && probes[s.id].latestPublishedAt && (
                            <span className="block text-gold-300">
                              {probes[s.id].itemsWithoutDate} of {probes[s.id].itemCount} items carry no date
                            </span>
                          )}
                          {probes[s.id].sampleTitles.map((t, i) => (
                            <span key={i} className="block truncate text-cream-400">
                              · {t}
                            </span>
                          ))}
                          {probes[s.id].error && (
                            <span className="block text-gold-300">{probes[s.id].error}</span>
                          )}
                          {/* The dead end this tool would otherwise walk you
                              into: a real feed found on a row registered as
                              html_scrape is still skipped as unsupported, so
                              the source would be verified, approved, active
                              and never fetched. */}
                          {probes[s.id].ok &&
                            methodFor(probes[s.id].format) !== s.ingestion && (
                              <span className="block text-gold-300">
                                registered as {s.ingestion} — Edit and set it to{" "}
                                {methodFor(probes[s.id].format)}, or the engine will keep skipping
                                this source as unsupported
                              </span>
                            )}
                          <span className="block">
                            Nothing was ingested. This does not grant retrieval.
                          </span>
                        </span>
                      )}
                    </span>

                    {s.licenseNotes && (
                      <span className="mt-1 block text-[0.72rem] text-gold-300">{s.licenseNotes}</span>
                    )}
                  </td>
                  <td className="f-mono py-2 pr-4 tabular-nums text-cream-400">{s.tier}</td>
                  <td className="py-2 pr-4 text-cream-400">{s.jurisdictions.join(", ")}</td>
                  <td className="f-mono py-2 pr-4 text-[0.72rem] text-cream-400">{s.ingestion}</td>
                  <td className="f-mono py-2 pr-4 tabular-nums text-cream-400">{s.frequency}m</td>

                  {/* Where a person has got to. Deliberately NOT a permission:
                      choosing "Retrieval approved" records that somebody read
                      the terms, and the switch to its right is still what
                      starts a fetch. The one exception is "Do not use", which
                      withdraws both permissions, because a row examined and
                      rejected must not keep fetching. */}
                  <td className="py-2 pr-4">
                    <select
                      value={s.reviewStatus}
                      disabled={busy === s.id}
                      onChange={(e) => setReview(s.id, e.target.value)}
                      className="input-stai-sm"
                    >
                      {REVIEW_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {s.reviewedBy && (
                      <span className="f-mono mt-1 block text-[0.65rem]" style={{ color: "var(--ink-faint)" }}>
                        {s.reviewedBy}
                        {s.reviewedAt ? ` · ${s.reviewedAt.slice(0, 10)}` : ""}
                      </span>
                    )}
                    {s.reviewNote && (
                      <span className="mt-1 block text-[0.68rem] text-gold-300">{s.reviewNote}</span>
                    )}
                  </td>

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
