"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_FREQUENCY,
  DEFAULT_RETENTION,
  INGESTION_METHODS,
  RETENTION,
  SOURCE_TYPES,
  TIERS,
  TIER_MEANING,
  type Tier,
} from "@/lib/newsroom/sources";
import { JURISDICTIONS } from "@/lib/newsroom/jurisdictions";

/**
 * Registering one source by hand.
 *
 * ── Why this is a form and not a spreadsheet import ─────────────────────
 * The proposal loader exists for the bulk case and puts fifty dormant rows in
 * at once. This is the other case, and it is the one that happens forever: a
 * regulator publishes something, an operator finds the feed, and the source
 * should be in the registry before the memory of finding it fades.
 *
 * Every field the engine needs is here and none of it is optional-by-default,
 * because a half-registered source is worse than an absent one — it sits in
 * the list looking registered. The one deliberate exception is the feed URL
 * for `manual` sources, which by definition have nowhere to fetch from.
 *
 * ── What this form CANNOT do ────────────────────────────────────────────
 * It cannot switch a source on, and it cannot grant retrieval. A row created
 * here is inactive and not retrievable, exactly like a row from the proposal
 * loader, and turning it on is a separate act in the table below that records
 * who did it. That is decision D5 and it is the whole reason the registry
 * exists: adding a source and permitting outbound requests to it are two
 * different decisions, and a form that did both would quietly merge them.
 *
 * The server re-validates everything through `validateSource`, which is the
 * same function the proposal loader goes through. Nothing here is trusted;
 * the fields below exist to make the valid answer easy to give, not to
 * decide what is valid.
 */

export const TYPE_LABEL: Record<string, string> = {
  regulator: "Regulator",
  standard_setter: "Standard setter",
  vendor: "Vendor",
  firm: "Firm",
  news: "News",
  research: "Research",
  professional_body: "Professional body",
  community: "Community",
};

const METHOD_LABEL: Record<string, string> = {
  rss: "RSS feed",
  atom: "Atom feed",
  json_api: "JSON API",
  html_scrape: "HTML extractor",
  manual: "Manual — entered by hand",
};

export const RETENTION_LABEL: Record<string, string> = {
  indefinite: "Indefinite — official texts",
  ninety_days: "90 days",
  reference_only: "Reference only — metadata, no body",
};

export default function AddSource() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [type, setType] = useState<string>("regulator");
  const [tier, setTier] = useState<Tier>(1);
  const [method, setMethod] = useState<string>("rss");
  const [feedUrl, setFeedUrl] = useState("");
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  // Blank means "whatever this tier defaults to", which is shown in the
  // placeholder. Storing the default as a value instead would make a later
  // change to the defaults silently not apply to rows added today.
  const [frequency, setFrequency] = useState("");
  const [retention, setRetention] = useState("");
  const [licenseNotes, setLicenseNotes] = useState("");

  const needsFeed = method !== "manual";

  function reset() {
    setName("");
    setDomain("");
    setType("regulator");
    setTier(1);
    setMethod("rss");
    setFeedUrl("");
    setJurisdictions([]);
    setFrequency("");
    setRetention("");
    setLicenseNotes("");
  }

  function toggleJurisdiction(code: string) {
    setJurisdictions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    try {
      const res = await fetch("/api/admin/newsroom/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          domain,
          source_type: type,
          authority_tier: tier,
          ingestion_method: method,
          feed_url: needsFeed ? feedUrl : "",
          jurisdictions,
          fetch_frequency: frequency ? Number(frequency) : undefined,
          snapshot_retention: retention || undefined,
          license_notes: licenseNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      setDone(
        `${name} registered — inactive and not retrievable. Test it, then switch it on below.`
      );
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the source");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-6">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">
          + Add a source
        </button>
        {done && <p className="f-mono mt-3 text-[0.75rem] text-gold-300">{done}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 border p-5 rule">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="f-label" style={{ color: "var(--ink-faint)" }}>
            Add a source
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Registers one publication as an{" "}
            <span className="text-cream-200">inactive, non-retrievable</span> row. Nothing is
            fetched when you save this — use <span className="text-cream-200">Test source</span> on
            the new row to see what the URL serves, then switch it on.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="btn btn-ghost btn-sm shrink-0"
        >
          Cancel
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="European Banking Authority"
            className="input-stai mt-1 w-full"
          />
        </label>

        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Domain
          </span>
          <input
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="eba.europa.eu"
            className="input-stai mt-1 w-full"
          />
          {/* The rule that makes the tier mean something, said before it is
              enforced rather than after it is rejected. */}
          <span className="f-mono mt-1 block text-[0.68rem]" style={{ color: "var(--ink-faint)" }}>
            No https:// and no www. The feed URL must sit on this domain.
          </span>
        </label>

        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Type
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input-stai mt-1 w-full"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Authority tier
          </span>
          <select
            value={tier}
            onChange={(e) => setTier(Number(e.target.value) as Tier)}
            className="input-stai mt-1 w-full"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[0.72rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
            {TIER_MEANING[tier]}
          </span>
        </label>

        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Ingestion method
          </span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="input-stai mt-1 w-full"
          >
            {INGESTION_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m] ?? m}
              </option>
            ))}
          </select>
          {method === "html_scrape" && (
            /* Said here rather than discovered later as a silent empty feed.
               There is no generic scraper, so this method does nothing at all
               until a per-publisher extractor exists for the domain. */
            <span className="mt-1 block text-[0.72rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
              Only works if an extractor has been written for this publisher — there is no generic
              scraper. The row will read <span className="f-mono">unsupported</span> until one is.
            </span>
          )}
        </label>

        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Feed URL {needsFeed ? "" : "— not used for manual sources"}
          </span>
          <input
            required={needsFeed}
            disabled={!needsFeed}
            value={needsFeed ? feedUrl : ""}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://www.eba.europa.eu/rss.xml"
            className="input-stai mt-1 w-full disabled:opacity-40"
          />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="f-label" style={{ color: "var(--ink-faint)" }}>
          Jurisdictions
        </legend>
        <p className="mt-1 text-[0.72rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
          At least one. This is what decides whose desk an item reaches, so a source covering two
          countries needs both.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {JURISDICTIONS.filter((j) => j.inScope).map((j) => {
            const on = jurisdictions.includes(j.code);
            return (
              <button
                key={j.code}
                type="button"
                aria-pressed={on}
                onClick={() => toggleJurisdiction(j.code)}
                className={on ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              >
                {j.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Fetch every (minutes)
          </span>
          <input
            type="number"
            min={15}
            max={10080}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder={`${DEFAULT_FREQUENCY[tier]} — the Tier ${tier} default`}
            className="input-stai mt-1 w-full"
          />
        </label>

        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Snapshot retention
          </span>
          <select
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            className="input-stai mt-1 w-full"
          >
            <option value="">
              {RETENTION_LABEL[DEFAULT_RETENTION[tier]]} — the Tier {tier} default
            </option>
            {RETENTION.map((r) => (
              <option key={r} value={r}>
                {RETENTION_LABEL[r] ?? r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-5 block">
        <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
          Licence notes
        </span>
        <textarea
          rows={2}
          value={licenseNotes}
          onChange={(e) => setLicenseNotes(e.target.value)}
          placeholder="What the terms and robots.txt say about automated retrieval."
          className="input-stai mt-1 w-full"
        />
      </label>

      {error && (
        <p className="f-mono mt-4 text-[0.75rem]" style={{ color: "var(--color-signal-down)" }}>
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "Registering…" : "Register source (inactive)"}
        </button>
        <span className="f-mono text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
          Saving does not fetch anything and does not grant retrieval.
        </span>
      </div>
    </form>
  );
}
