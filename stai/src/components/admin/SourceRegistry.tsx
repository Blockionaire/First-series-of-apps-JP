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
  /** False when the engine has no way to read this source at all. */
  supported: boolean;
  /** Derived server-side by `liveState`. See the dot below. */
  status: string;
};

/**
 * What the dot means.
 *
 * Computed by `liveState` in lib/newsroom/sources.ts and passed in, NOT
 * recomputed here. The filter below selects on the same value, so the dot and
 * the filter cannot disagree — a filter that hides a row the dot calls live is
 * worse than no filter, because it is believed.
 */
const STATUS_STYLE: Record<string, { dot: string; label: string; title: string }> = {
  live: {
    dot: "var(--color-signal-up)",
    label: "Live",
    title: "On, permitted and retrieving successfully",
  },
  waiting: {
    dot: "var(--color-gold-300)",
    label: "Waiting",
    title: "On and permitted, but nothing retrieved yet",
  },
  broken: {
    dot: "var(--color-signal-down)",
    label: "Broken",
    title: "On and permitted, but failing — this one needs you",
  },
  dormant: {
    dot: "var(--color-navy-600)",
    label: "Not live",
    title: "Switched off or retrieval not permitted — nothing is wrong, it is just not running",
  },
  excluded: {
    dot: "var(--color-navy-600)",
    label: "Do not use",
    title: "Examined and rejected",
  },
};

function StatusDot({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.dormant;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap" title={s.title}>
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{
          background: s.dot,
          // A ring only on the live one. It is the state being scanned for,
          // and on a table of fifty rows a flat dot of any colour reads as
          // decoration until something makes one of them the signal.
          boxShadow: status === "live" ? `0 0 0 3px color-mix(in srgb, ${s.dot} 25%, transparent)` : "none",
        }}
      />
      {/* The word, not only the colour. Roughly one man in twelve cannot tell
          the green from the red, and this table's whole job is at-a-glance
          triage. */}
      <span className="f-mono text-[0.7rem]">{s.label}</span>
    </span>
  );
}

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
  /** Which hand-written extractor read the page, when one did. */
  extractor?: string;
  /** Links that extractor saw and refused. */
  rejectedCount?: number;
};

/**
 * The registry's word for what the prober detected.
 *
 * `parseFeed` says "json"; the registry's ingestion method is "json_api". One
 * mapping, so the mismatch warning compares like with like rather than telling
 * an operator to set a value the dropdown does not offer.
 */
function methodFor(format: string): string {
  if (format === "json") return "json_api";
  // A page read by a hand-written extractor is registered as html_scrape —
  // that is the method, and "html_extractor" is what happened, not a value the
  // dropdown offers. Without this the mismatch warning would tell an operator
  // to set something they cannot set.
  if (format === "html_extractor") return "html_scrape";
  return format;
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

  /* ── Filtering ────────────────────────────────────────────────────────
   * Client-side, over rows already in hand. Fifty-odd rows is nothing to
   * filter in the browser, and a round trip per keystroke would make the
   * search box feel broken for no gain. It also means filtering never costs a
   * database read while somebody is working through the list.
   *
   * Deliberately NOT in the URL. An operator switching a source on wants the
   * page to refresh in place with their filter intact; putting it in the query
   * string would work too, but router.refresh() already preserves component
   * state and the simpler thing is the one with fewer ways to be wrong.
   */
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fTier, setFTier] = useState("");
  const [fMethod, setFMethod] = useState("");
  const [fReview, setFReview] = useState("");
  const [fJurisdiction, setFJurisdiction] = useState("");

  const jurisdictionOptions = [
    ...new Set(sources.flatMap((s) => s.jurisdictions)),
  ].sort();

  const visible = sources.filter((s) => {
    if (fStatus && s.status !== fStatus) return false;
    if (fTier && String(s.tier) !== fTier) return false;
    if (fMethod && s.ingestion !== fMethod) return false;
    if (fReview && s.reviewStatus !== fReview) return false;
    if (fJurisdiction && !s.jurisdictions.includes(fJurisdiction)) return false;
    if (q.trim()) {
      // Name, domain and the feed URL together: an operator hunting a broken
      // source usually has the URL in front of them, not the display name.
      const hay = `${s.name} ${s.domain} ${s.feedUrl}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const filtered = Boolean(q.trim() || fStatus || fTier || fMethod || fReview || fJurisdiction);
  function clearFilters() {
    setQ("");
    setFStatus("");
    setFTier("");
    setFMethod("");
    setFReview("");
    setFJurisdiction("");
  }

  /** Counts across EVERY row, not the filtered view — a tally that changed as
   *  you filtered would be useless for deciding what to filter to. */
  const tally = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

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
        <>
          {/* The three questions this page gets asked, as one click each.
              Counted over every row rather than the filtered view: a tally
              that changed as you filtered could not tell you what to filter
              to. */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[
              { id: "", label: `All ${sources.length}` },
              { id: "live", label: `Live ${tally.live ?? 0}` },
              { id: "broken", label: `Broken ${tally.broken ?? 0}` },
              { id: "waiting", label: `Waiting ${tally.waiting ?? 0}` },
              { id: "dormant", label: `Not live ${tally.dormant ?? 0}` },
              { id: "excluded", label: `Do not use ${tally.excluded ?? 0}` },
            ].map((chip) => (
              <button
                key={chip.id || "all"}
                type="button"
                onClick={() => setFStatus(chip.id)}
                className={fStatus === chip.id ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              >
                {chip.id && (
                  <span
                    aria-hidden="true"
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: STATUS_STYLE[chip.id]?.dot }}
                  />
                )}
                {chip.label}
              </button>
            ))}
          </div>

          <p className="f-mono mt-3 text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
            Showing {visible.length} of {sources.length}
            {filtered && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="underline underline-offset-4 hover:text-cream-100"
                >
                  clear filters
                </button>
              </>
            )}
          </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[0.82rem]">
            <thead>
              <tr className="f-label border-b rule" style={{ color: "var(--ink-faint)" }}>
                <th className="py-2 pr-4">Status</th>
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
              {/* The filter row, under the labels it filters. Each control
                  sits in its own column so there is no legend to read — the
                  thing above the box says what the box narrows. */}
              <tr className="border-b rule align-top">
                <th className="py-2 pr-4">
                  <select
                    aria-label="Filter by status"
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value)}
                    className="input-stai-sm w-full"
                  >
                    <option value="">Any</option>
                    {["live", "waiting", "broken", "dormant", "excluded"].map((v) => (
                      <option key={v} value={v}>
                        {STATUS_STYLE[v].label}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="py-2 pr-4">
                  <input
                    type="search"
                    aria-label="Filter by name, domain or URL"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="name, domain or URL"
                    className="input-stai-sm w-full"
                  />
                </th>
                <th className="py-2 pr-4">
                  <select
                    aria-label="Filter by tier"
                    value={fTier}
                    onChange={(e) => setFTier(e.target.value)}
                    // The Tier column is one character wide, so `w-full`
                    // collapsed this to a sliver with its own label clipped.
                    // A minimum wide enough for "Any" plus the chevron.
                    className="input-stai-sm w-full min-w-[4.5rem]"
                  >
                    <option value="">Any</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </th>
                <th className="py-2 pr-4">
                  <select
                    aria-label="Filter by jurisdiction"
                    value={fJurisdiction}
                    onChange={(e) => setFJurisdiction(e.target.value)}
                    className="input-stai-sm w-full"
                  >
                    <option value="">Any</option>
                    {jurisdictionOptions.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="py-2 pr-4">
                  <select
                    aria-label="Filter by method"
                    value={fMethod}
                    onChange={(e) => setFMethod(e.target.value)}
                    className="input-stai-sm w-full"
                  >
                    <option value="">Any</option>
                    {["rss", "atom", "json_api", "html_scrape", "manual"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="py-2 pr-4" />
                <th className="py-2 pr-4">
                  <select
                    aria-label="Filter by review status"
                    value={fReview}
                    onChange={(e) => setFReview(e.target.value)}
                    className="input-stai-sm w-full"
                  >
                    <option value="">Any</option>
                    {REVIEW_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="py-2 pr-4" />
                <th className="py-2 pr-4" />
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                    No source matches those filters.{" "}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="underline underline-offset-4 hover:text-cream-100"
                    >
                      Clear them
                    </button>
                    .
                  </td>
                </tr>
              )}
              {visible.map((s) => (
                <tr key={s.id} className="border-b rule align-top">
                  <td className="py-2 pr-4">
                    <StatusDot status={s.status} />
                    {/* Why it is not live, where the reason is not the health
                        column's business. An html_scrape row with no extractor
                        reads as permitted and healthy and will never fetch. */}
                    {!s.supported && (
                      <span className="f-mono mt-1 block text-[0.65rem] text-gold-300">
                        no extractor
                      </span>
                    )}
                  </td>
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
                            {probes[s.id].ok ? "usable" : "not usable"} ·{" "}
                            {probes[s.id].httpStatus ?? "no response"} · {probes[s.id].format} ·{" "}
                            {probes[s.id].itemCount} item
                            {probes[s.id].itemCount === 1 ? "" : "s"} · {probes[s.id].durationMs}ms
                          </span>
                          {/* Which extractor read the page, and how much it
                              refused. A jump in the rejected count is a
                              template change in progress. */}
                          {probes[s.id].extractor && (
                            <span className="block">
                              read by {probes[s.id].extractor}
                              {typeof probes[s.id].rejectedCount === "number"
                                ? ` · ${probes[s.id].rejectedCount} links refused as not publications`
                                : ""}
                            </span>
                          )}
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
        </>
      )}
    </section>
  );
}
