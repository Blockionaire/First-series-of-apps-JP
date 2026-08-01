"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function destroy(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Deletion failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="f-mono text-[0.66rem] tracking-[0.1em] uppercase underline underline-offset-4"
        style={{ color: "var(--ink-faint)" }}
      >
        Delete account and data
      </button>
    );
  }

  return (
    <form onSubmit={destroy} className="max-w-md border p-4 rule-strong">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Permanent erasure
      </p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        This deletes your account, saved briefings, saved prompts, saved answers and newsletter
        subscription — immediately and irreversibly. Any active membership is cancelled.
      </p>
      <label htmlFor="del-pass" className="f-label mt-4 block" style={{ color: "var(--ink-muted)" }}>
        Confirm with your password
      </label>
      <input
        id="del-pass"
        type="password"
        required
        autoComplete="current-password"
        className="input-stai mt-1.5"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p role="alert" className="f-mono mt-2 text-[0.7rem] text-signal-down">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <button type="submit" className="btn btn-ghost" disabled={busy || password.length === 0}>
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          type="button"
          className="f-mono text-[0.68rem] uppercase tracking-[0.1em] text-cream-400"
          onClick={() => {
            setOpen(false);
            setPassword("");
            setError("");
          }}
        >
          Keep my account
        </button>
      </div>
    </form>
  );
}
