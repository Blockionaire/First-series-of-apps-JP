"use client";

import { useState } from "react";

const PROGRAMME_OPTIONS = ["Copilot Beginners", "Copilot Experienced", "Full AI Package", "Not sure yet — advise us"];

export default function EnquiryForm({ preselect }: { preselect?: string }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    firm: "",
    programme: preselect ?? PROGRAMME_OPTIONS[1],
    seats: "",
    message: "",
  });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [ref, setRef] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setRef(j.ref);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="border p-6 rule-strong" role="status">
        <p className="f-mono text-[0.68rem] font-bold tracking-[0.16em] uppercase text-cream-100">
          Enquiry logged — {ref}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          It&apos;s on the training desk. You&apos;ll hear from us within one working day with dates and a
          proposal — a confirmation is on its way to {form.email}. Early-bird pricing is locked from the moment
          this enquiry was logged.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="enq-name" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Your name *
        </label>
        <input id="enq-name" required className="input-stai mt-1.5" value={form.name} onChange={set("name")} autoComplete="name" />
      </div>
      <div>
        <label htmlFor="enq-email" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Work email *
        </label>
        <input id="enq-email" type="email" required className="input-stai mt-1.5" value={form.email} onChange={set("email")} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="enq-firm" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Firm *
        </label>
        <input id="enq-firm" required className="input-stai mt-1.5" value={form.firm} onChange={set("firm")} autoComplete="organization" />
      </div>
      <div>
        <label htmlFor="enq-prog" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Programme
        </label>
        <select id="enq-prog" className="input-stai mt-1.5" value={form.programme} onChange={set("programme")}>
          {PROGRAMME_OPTIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="enq-seats" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Approx. participants
        </label>
        <input id="enq-seats" className="input-stai mt-1.5" placeholder="e.g. 12, or 40 across teams" value={form.seats} onChange={set("seats")} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="enq-msg" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Anything we should know
        </label>
        <textarea
          id="enq-msg"
          className="input-stai mt-1.5 min-h-24 resize-y"
          placeholder="Current tooling, timelines, locations, what's driving this now…"
          value={form.message}
          onChange={set("message")}
        />
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Send enquiry"}
        </button>
        {state === "error" && (
          <p role="alert" className="f-mono text-[0.7rem] text-signal-down">
            Something failed — check the required fields and try again.
          </p>
        )}
        <p className="f-mono text-[0.62rem] tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
          Goes straight to the training desk — answered within one working day.
        </p>
      </div>
    </form>
  );
}
