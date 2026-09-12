"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/account";
  const [form, setForm] = useState({ name: "", firm: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Something went wrong");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "signup" && (
        <>
          <div>
            <label htmlFor="au-name" className="f-label" style={{ color: "var(--ink-muted)" }}>
              Name *
            </label>
            <input id="au-name" required className="input-stai mt-1.5" value={form.name} onChange={set("name")} autoComplete="name" />
          </div>
          <div>
            <label htmlFor="au-firm" className="f-label" style={{ color: "var(--ink-muted)" }}>
              Firm (optional)
            </label>
            <input id="au-firm" className="input-stai mt-1.5" value={form.firm} onChange={set("firm")} autoComplete="organization" />
          </div>
        </>
      )}
      <div>
        <label htmlFor="au-email" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Work email *
        </label>
        <input id="au-email" type="email" required className="input-stai mt-1.5" value={form.email} onChange={set("email")} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="au-pass" className="f-label" style={{ color: "var(--ink-muted)" }}>
          Password * {mode === "signup" && <span className="normal-case tracking-normal">(8+ characters)</span>}
        </label>
        <input
          id="au-pass"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          className="input-stai mt-1.5"
          value={form.password}
          onChange={set("password")}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </div>
      {error && (
        <p role="alert" className="f-mono border px-3 py-2 text-[0.72rem] text-signal-down" style={{ borderColor: "rgba(196,122,106,0.4)" }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "…" : mode === "signup" ? "Create free account" : "Sign in"}
      </button>
      <p className="f-mono text-[0.7rem] tracking-[0.04em]" style={{ color: "var(--ink-faint)" }}>
        {mode === "signup" ? (
          <>
            Already on the desk?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-cream-400 underline underline-offset-4 hover:text-cream-100">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-cream-400 underline underline-offset-4 hover:text-cream-100">
              Create a free account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
