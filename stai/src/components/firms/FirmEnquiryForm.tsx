"use client";

import { useState } from "react";
import { FIRM_INTERESTS, FIRM_SIZES, JURISDICTIONS, FIRM_ROLES } from "@/lib/firms";

export default function FirmEnquiryForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    firm: "",
    role: "",
    firmSize: "",
    jurisdiction: "",
    seats: "",
    message: "",
  });
  const [interests, setInterests] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [ref, setRef] = useState("");
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
      const res = await fetch("/api/firm-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, interests }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Something went wrong");
      setRef(j.ref);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="border p-6 rule-strong" role="status">
        <p className="f-mono text-[0.68rem] font-bold tracking-[0.16em] uppercase text-cream-100">
          Logged — {ref}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          It&apos;s with us. You&apos;ll hear from a founder — not a sales sequence — within one working day,
          with straight answers on what exists today and what timeline the rest is on. A confirmation is on its
          way to {form.email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* interests first: this is the question we most want answered */}
      <fieldset>
        <legend className="f-label" style={{ color: "var(--ink-muted)" }}>
          What should we talk about? Choose any.
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FIRM_INTERESTS.map((i) => {
            const on = interests.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => toggle(i.id)}
                aria-pressed={on}
                className={`flex flex-col border p-4 text-left transition-colors ${
                  on ? "border-cream-400 bg-navy-800" : "rule hover:border-[var(--line-strong)]"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[0.95rem] font-medium text-cream-100">{i.label}</span>
                  <span
                    className="f-mono shrink-0 text-[0.55rem] tracking-[0.12em] uppercase"
                    style={{ color: i.available ? "var(--color-signal-up)" : "var(--ink-faint)" }}
                  >
                    {i.available ? "Available now" : "In development"}
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
        <div>
          <label htmlFor="fe-firm" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Firm *
          </label>
          <input id="fe-firm" required className="input-stai mt-1.5" value={form.firm} onChange={set("firm")} autoComplete="organization" />
        </div>
        <div>
          <label htmlFor="fe-size" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Size
          </label>
          <select id="fe-size" className="input-stai mt-1.5" value={form.firmSize} onChange={set("firmSize")}>
            <option value="">Select…</option>
            {FIRM_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fe-jur" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Jurisdiction
          </label>
          <select id="fe-jur" className="input-stai mt-1.5" value={form.jurisdiction} onChange={set("jurisdiction")}>
            <option value="">Select…</option>
            {JURISDICTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fe-role" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Your role
          </label>
          <select id="fe-role" className="input-stai mt-1.5" value={form.role} onChange={set("role")}>
            <option value="">Select…</option>
            {FIRM_ROLES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fe-name" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Your name *
          </label>
          <input id="fe-name" required className="input-stai mt-1.5" value={form.name} onChange={set("name")} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="fe-email" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Work email *
          </label>
          <input id="fe-email" type="email" required className="input-stai mt-1.5" value={form.email} onChange={set("email")} autoComplete="email" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fe-seats" className="f-label" style={{ color: "var(--ink-muted)" }}>
            Roughly how many professionals would use it?
          </label>
          <input id="fe-seats" className="input-stai mt-1.5" placeholder="e.g. 45 in audit, 120 firm-wide" value={form.seats} onChange={set("seats")} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fe-msg" className="f-label" style={{ color: "var(--ink-muted)" }}>
            What&apos;s driving this now?
          </label>
          <textarea
            id="fe-msg"
            className="input-stai mt-1.5 min-h-24 resize-y"
            placeholder="Inspection coming up, AI Act deadline, a board question you can't answer yet, tooling already in use…"
            value={form.message}
            onChange={set("message")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Send to the founders"}
        </button>
        {state === "error" && (
          <p role="alert" className="f-mono text-[0.7rem] text-signal-down">
            {error}
          </p>
        )}
        <p className="f-mono text-[0.62rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
          No sales sequence. A founder replies within one working day.
        </p>
      </div>
    </form>
  );
}
