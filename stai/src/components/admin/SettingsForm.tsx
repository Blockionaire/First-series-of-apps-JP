"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LimitField, TextField, Toggle } from "@/lib/site-config";

type Props = {
  toggles: Toggle[];
  enabled: Record<string, boolean>;
  textFields: TextField[];
  copy: Record<string, string>;
  limitFields: LimitField[];
  limits: Record<string, number>;
};

/**
 * One form for everything the operator can change without a deploy.
 *
 * It collects the whole page and saves in a single request rather than firing
 * one per switch. Half-applied settings are the failure mode worth avoiding:
 * a page hidden from the navigation while its route is still open is exactly
 * the state this feature exists to prevent, and per-control autosave makes it
 * reachable every time a request fails midway.
 */
export default function SettingsForm({ toggles, enabled, textFields, copy, limitFields, limits }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(toggles.map((t) => [`page.${t.id}.enabled`, enabled[t.id] ? "1" : "0"])),
    ...Object.fromEntries(textFields.map((f) => [f.key, copy[f.key] ?? ""])),
    ...Object.fromEntries(limitFields.map((f) => [f.key, String(limits[f.key] ?? f.fallback)])),
  }));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const set = (k: string, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    setState("idle");
  };

  async function save() {
    setState("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState("saved");
      setMessage(`${json.written} setting${json.written === 1 ? "" : "s"} saved`);
      // The navigation, the guards and the homepage all read these on the
      // server, so the page has to be re-fetched for the change to be visible.
      router.refresh();
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="mt-8 space-y-12">
      <section>
        <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Pages and features
        </h2>
        <p className="mt-2 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
          Switching something off removes it from every menu <em>and</em> makes its address answer 404. It also
          leaves the sitemap, so crawlers drop it rather than keep returning to a dead URL.
        </p>
        <ul className="mt-4 divide-y rule">
          {toggles.map((t) => {
            const key = `page.${t.id}.enabled`;
            const on = values[key] === "1";
            return (
              <li key={t.id} className="flex items-start justify-between gap-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-cream-200">
                    {t.label}
                    {t.path && (
                      <span className="f-mono ml-2 text-[0.65rem]" style={{ color: "var(--ink-faint)" }}>
                        {t.path}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[0.78rem]" style={{ color: "var(--ink-muted)" }}>
                    {t.blurb}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${t.label} — ${on ? "on" : "off"}`}
                  onClick={() => set(key, on ? "0" : "1")}
                  className="f-mono mt-0.5 inline-flex w-16 shrink-0 items-center justify-center border px-2 py-1.5 text-[0.62rem] tracking-[0.14em] uppercase transition-colors"
                  style={{
                    borderColor: on ? "var(--color-signal-up)" : "var(--line-strong)",
                    color: on ? "var(--color-signal-up)" : "var(--ink-faint)",
                  }}
                >
                  {on ? "On" : "Off"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Homepage and calls to action
        </h2>
        <p className="mt-2 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
          Leave a field empty to fall back to what the site shipped with — the placeholder shows what that is.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {textFields.map((f) => (
            <label key={f.key} className={f.multiline ? "sm:col-span-2" : undefined}>
              <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
                {f.label}
              </span>
              {f.multiline ? (
                <textarea
                  rows={3}
                  value={values[f.key] ?? ""}
                  placeholder={f.fallback}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="input-stai mt-1 w-full"
                />
              ) : (
                <input
                  type="text"
                  value={values[f.key] ?? ""}
                  placeholder={f.fallback || "— site slogan —"}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="input-stai mt-1 w-full"
                />
              )}
              {f.help && (
                <span className="mt-1 block text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
                  {f.help}
                </span>
              )}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Reader limits
        </h2>
        <p className="mt-2 text-[0.8rem]" style={{ color: "var(--ink-muted)" }}>
          These bound what the platform spends on model calls. Values outside the stated range are clamped on save.
        </p>
        <div className="mt-4 space-y-4">
          {limitFields.map((f) => (
            <label key={f.key} className="block">
              <span className="f-label block" style={{ color: "var(--ink-faint)" }}>
                {f.label}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={f.min}
                max={f.max}
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                className="input-stai mt-1 w-40"
              />
              <span className="f-mono ml-3 text-[0.65rem]" style={{ color: "var(--ink-faint)" }}>
                {f.min}–{f.max}, default {f.fallback}
              </span>
              <span className="mt-1 block max-w-2xl text-[0.78rem]" style={{ color: "var(--ink-muted)" }}>
                {f.help}
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t bg-navy-900/95 py-4 backdrop-blur-sm rule-strong">
        <button type="button" onClick={save} disabled={state === "saving"} className="btn btn-primary">
          {state === "saving" ? "Saving…" : "Save settings"}
        </button>
        {state !== "idle" && state !== "saving" && (
          <p
            role="status"
            className="f-mono text-[0.72rem]"
            style={{ color: state === "error" ? "var(--color-signal-down)" : "var(--color-signal-up)" }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
