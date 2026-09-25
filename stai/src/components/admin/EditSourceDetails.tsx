"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_FREQUENCY,
  DEFAULT_RETENTION,
  RETENTION,
  SOURCE_TYPES,
  TIERS,
  TIER_MEANING,
  type Tier,
} from "@/lib/newsroom/sources";
import { JURISDICTIONS } from "@/lib/newsroom/jurisdictions";
import { RETENTION_LABEL, TYPE_LABEL } from "./AddSource";

/**
 * Correcting an existing source's details.
 *
 * Everything the Add form sets except the three fields that decide WHERE we
 * fetch from: the domain is the source's identity, and the feed URL and
 * method have their own editor on the row because changing them resets
 * retrieval permission. Nothing here does — it does not touch Retrievable or
 * On, and it fetches nothing.
 *
 * The server re-validates through `validateSource`, the same rules as
 * registration, and logs every change with who made it.
 */
export type EditableSource = {
  id: number;
  name: string;
  domain: string;
  type: string;
  tier: number;
  jurisdictionCodes: string[];
  frequency: number;
  retention: string;
  licenseNotes: string;
  active: boolean;
};

export default function EditSourceDetails({
  source,
  onClose,
  onSaved,
}: {
  source: EditableSource;
  onClose: () => void;
  onSaved: (changes: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(source.name);
  const [type, setType] = useState(source.type);
  const [tier, setTier] = useState<Tier>(source.tier as Tier);
  const [jurisdictions, setJurisdictions] = useState<string[]>(source.jurisdictionCodes);
  const [frequency, setFrequency] = useState(String(source.frequency));
  const [retention, setRetention] = useState(source.retention);
  const [licenseNotes, setLicenseNotes] = useState(source.licenseNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Every in-scope market, plus anything this source already carries that is
  // not — so an out-of-scope tag can be seen and removed rather than hidden.
  const options = JURISDICTIONS.filter((j) => j.inScope || source.jurisdictionCodes.includes(j.code));

  const tierChanged = tier !== source.tier;
  // Frequency and retention are stored values, not "whatever the tier says",
  // so a tier change leaves them alone. Offered, not applied: retention is a
  // licensing decision and must not change as a side effect.
  const offDefaults =
    tierChanged &&
    (Number(frequency) !== DEFAULT_FREQUENCY[tier] || retention !== DEFAULT_RETENTION[tier]);

  function toggle(code: string) {
    setJurisdictions((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/newsroom/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_details",
          id: source.id,
          name,
          source_type: type,
          authority_tier: tier,
          jurisdictions,
          fetch_frequency: Number(frequency),
          snapshot_retention: retention,
          license_notes: licenseNotes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSaved(json.changes ?? "");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="border p-4 rule" aria-label={`Edit details of ${source.name}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Edit details · {source.domain}
          </p>
          <p className="mt-1 max-w-2xl text-[0.78rem] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Changes apply to items retrieved from now on; stories already built keep their counts.
            Retrievable and On are not changed. The feed URL is edited on the row itself, and the
            domain cannot be changed — register a new source for a different domain.
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm shrink-0">
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Name
          </span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input-stai mt-1 w-full" />
        </label>

        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Type
          </span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-stai mt-1 w-full">
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
        </label>
      </div>

      <p className="mt-2 text-[0.72rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
        Tier {tier}: {TIER_MEANING[tier]}
      </p>
      {tierChanged && (
        <p className="mt-1 text-[0.72rem] leading-relaxed text-gold-300">
          Changing the tier from {source.tier} to {tier} changes how much this source&apos;s word is
          trusted{source.active ? " — and it is switched on, so it takes effect from the next run" : ""}.
          The change is logged with your name.
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="f-label" style={{ color: "var(--ink-faint)" }}>
          Jurisdictions
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((j) => {
            const on = jurisdictions.includes(j.code);
            return (
              <button
                key={j.code}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(j.code)}
                className={on ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              >
                {j.label}
              </button>
            );
          })}
        </div>
        {jurisdictions.length === 0 && (
          <p className="mt-1 text-[0.72rem] text-gold-300">At least one jurisdiction is required.</p>
        )}
      </fieldset>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Fetch every (minutes)
          </span>
          <input
            type="number"
            min={15}
            max={10080}
            required
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="input-stai mt-1 w-full"
          />
        </label>
        <label className="block">
          <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
            Snapshot retention
          </span>
          <select value={retention} onChange={(e) => setRetention(e.target.value)} className="input-stai mt-1 w-full">
            {RETENTION.map((r) => (
              <option key={r} value={r}>
                {RETENTION_LABEL[r] ?? r}
              </option>
            ))}
          </select>
        </label>
      </div>

      {offDefaults && (
        <p className="mt-2 text-[0.72rem] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
          Tier {tier} defaults are every {DEFAULT_FREQUENCY[tier]} minutes and{" "}
          {(RETENTION_LABEL[DEFAULT_RETENTION[tier]] ?? DEFAULT_RETENTION[tier]).toLowerCase()} retention.{" "}
          <button
            type="button"
            onClick={() => {
              setFrequency(String(DEFAULT_FREQUENCY[tier]));
              setRetention(DEFAULT_RETENTION[tier]);
            }}
            className="underline underline-offset-4 text-cream-400 hover:text-cream-100"
          >
            Use Tier {tier} defaults
          </button>
        </p>
      )}

      <label className="mt-4 block">
        <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
          Licence notes
        </span>
        <textarea
          rows={2}
          value={licenseNotes}
          onChange={(e) => setLicenseNotes(e.target.value)}
          className="input-stai mt-1 w-full"
        />
      </label>

      {error && (
        <p className="f-mono mt-3 text-[0.75rem]" style={{ color: "var(--color-signal-down)" }}>
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || jurisdictions.length === 0} className="btn btn-primary btn-sm">
          {busy ? "Saving…" : "Save details"}
        </button>
        <span className="f-mono text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
          Fetches nothing; permissions unchanged.
        </span>
      </div>
    </form>
  );
}
