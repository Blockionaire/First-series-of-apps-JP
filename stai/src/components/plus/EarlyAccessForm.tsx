"use client";

import { useState } from "react";
import { EARLY_ACCESS_INTERESTS, EARLY_ACCESS_ROLES } from "@/lib/earlyaccess";

export default function EarlyAccessForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [form, setForm] = useState({ email: defaultEmail, name: "", firm: "", role: "", note: "" });
  const [interests, setInterests] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState("");

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggle = (id: string) =>
    setInterests((cur) => (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, interests }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Something went wrong");
      setUpdated(!!j.updated);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="border p-6 rule-strong" role="status">
        <p className="f-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase text-gold-300">
          {updated ? "Answers updated" : "You're on the list"}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Registered as <span className="text-cream-100">{form.email}</span>. We&apos;ll write once — when
          STAI+ actually opens — and not before. No confirmation email is on its way, because we are not
          sending any mail yet; this page is the confirmation.
        </p>
        <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
          What you told us about what would make it worth paying for genuinely decides what gets built first.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* The research question first: it is the reason this form exists. */}
      <fieldset>
        <legend className="f-display text-xl text-cream-100">
          What would make STAI+ worth paying for?
        </legend>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Optional, choose any. This is the part we actually act on.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {EARLY_ACCESS_INTERESTS.map((i) => {
            const on = interests.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => toggle(i.id)}
                aria-pressed={on}
                className={`flex flex-col border p-4 text-left transition-colors ${
                  on ? "border-[var(--gold-line)] bg-navy-800" : "rule hover:border-[var(--line-strong)]"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[0.95rem] font-medium text-cream-100">{i.label}</span>
                  <span
                    aria-hidden
                    className="f-mono shrink-0 text-[0.6rem]"
                    style={{ color: on ? "var(--color-gold-300)" : "var(--ink-faint)" }}
                  >
                    {on ? "✓" : "+"}
                  </span>
                </span>
                <span className="mt-1.5 text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {i.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="ea-email" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Email *
          </label>
          <input
            id="ea-email"
            type="email"
            required
            autoComplete="email"
            className="input-stai mt-1.5"
            placeholder="you@firm.eu"
            value={form.email}
            onChange={set("email")}
          />
        </div>
        <div>
          <label htmlFor="ea-name" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Name <span style={{ color: "var(--ink-faint)" }}>(optional)</span>
          </label>
          <input id="ea-name" autoComplete="name" className="input-stai mt-1.5" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label htmlFor="ea-firm" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Firm <span style={{ color: "var(--ink-faint)" }}>(optional)</span>
          </label>
          <input id="ea-firm" autoComplete="organization" className="input-stai mt-1.5" value={form.firm} onChange={set("firm")} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ea-role" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Role <span style={{ color: "var(--ink-faint)" }}>(optional)</span>
          </label>
          <select id="ea-role" className="input-stai mt-1.5" value={form.role} onChange={set("role")}>
            <option value="">Select…</option>
            {EARLY_ACCESS_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ea-note" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Anything else? <span style={{ color: "var(--ink-faint)" }}>(optional)</span>
          </label>
          <textarea
            id="ea-note"
            className="input-stai mt-1.5 min-h-20 resize-y"
            placeholder="The thing you wish existed and doesn't."
            value={form.note}
            onChange={set("note")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-plus premium-focus" disabled={state === "busy"}>
          {state === "busy" ? "Joining…" : "Join STAI+ early access"}
        </button>
        {state === "error" && (
          <p role="alert" className="f-mono text-[0.7rem] text-signal-down">
            {error}
          </p>
        )}
        <p className="f-mono text-[0.62rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
          No payment. No card. No confirmation email — we contact you once, when it opens.
        </p>
      </div>
    </form>
  );
}
