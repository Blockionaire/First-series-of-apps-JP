"use client";

import { useState } from "react";

export default function NewsletterForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setState("busy");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="f-mono border px-3 py-2.5 text-[0.72rem] tracking-[0.08em] rule-strong text-cream-100" role="status">
        SUBSCRIBED — first Brief lands Tuesday.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <label htmlFor={`nl-${source}`} className="sr-only">
        Work email for The STAI Brief
      </label>
      <input
        id={`nl-${source}`}
        type="email"
        required
        autoComplete="email"
        placeholder="you@firm.eu"
        className="input-stai f-mono text-[0.8rem]"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" disabled={state === "busy"}>
        {state === "busy" ? "…" : "Subscribe"}
      </button>
      {state === "error" && (
        <span role="alert" className="sr-only">
          Subscription failed, try again
        </span>
      )}
    </form>
  );
}
