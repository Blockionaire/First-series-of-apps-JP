"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type GrantRow = {
  id: number;
  email: string;
  name: string;
  reason: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string;
  live: boolean;
};

/**
 * Giving STAI+ away, on purpose and on the record.
 *
 * Every row says who granted it and why, because the question asked six
 * months later is never "who has free access" — that is easy — but "why does
 * this person have free access", and only a reason written at the time can
 * answer it.
 *
 * Ended grants stay listed. "Did we ever comp this person" is a real question
 * and a list of only the live ones cannot answer it.
 */
export default function AccessGrants({ grants }: { grants: GrantRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState<number | "grant" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  }

  async function grant() {
    setBusy("grant");
    setError("");
    setMessage("");
    try {
      const json = await post({ action: "grant", email, reason, expires_on: expires });
      setMessage(
        json.already
          ? `${json.email} already has a live grant — nothing changed.`
          : `${json.email} now has STAI+. They will see it on their next page load.`
      );
      setEmail("");
      setReason("");
      setExpires("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant that");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: number) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await post({ action: "revoke", id });
      setMessage("Grant withdrawn. The account is back to free on its next page load.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw that");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-12">
      <h2 className="f-label border-b pb-3 rule-strong" style={{ color: "var(--ink-faint)" }}>
        Complimentary STAI+
      </h2>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        Gives an existing account every STAI+ feature at no charge. This is{" "}
        <span className="text-cream-200">not</span> a subscription: nothing is written to the
        payment record, no price is shown to the member, and their account page says the access
        was given rather than bought. The account has to exist already — ask them to sign up
        first.
      </p>

      <div className="mt-5 grid gap-3 border p-5 rule sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="f-label" style={{ color: "var(--ink-faint)" }}>
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="them@example.com"
            className="input-stai mt-1.5"
          />
        </label>
        <label className="block">
          <span className="f-label" style={{ color: "var(--ink-faint)" }}>
            Reason
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="my second account / pilot firm / reviewer"
            className="input-stai mt-1.5"
          />
        </label>
        <label className="block">
          <span className="f-label" style={{ color: "var(--ink-faint)" }}>
            Expires
          </span>
          {/* Optional, and empty means indefinite — right for your own second
              account, wrong for most of the rest. Dating a grant at the outset
              is what stops a comp list quietly becoming permanent. */}
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="input-stai mt-1.5"
          />
        </label>
        <button
          type="button"
          onClick={grant}
          disabled={busy === "grant" || !email.trim() || !reason.trim()}
          className="btn btn-primary"
        >
          {busy === "grant" ? "Granting…" : "Grant"}
        </button>
      </div>

      {message && <p className="f-mono mt-4 text-[0.75rem] text-gold-300">{message}</p>}
      {error && (
        <p className="f-mono mt-4 text-[0.75rem]" style={{ color: "var(--color-signal-down)" }}>
          {error}
        </p>
      )}

      {grants.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-[0.82rem]">
            <thead>
              <tr className="f-label border-b rule" style={{ color: "var(--ink-faint)" }}>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Granted</th>
                <th className="py-2 pr-4">Until</th>
                <th className="py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-b rule align-top">
                  <td className="py-2 pr-4">
                    <span className="text-cream-200">{g.email}</span>
                    {g.name && (
                      <span className="f-mono block text-[0.7rem]" style={{ color: "var(--ink-faint)" }}>
                        {g.name}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-cream-400">{g.reason}</td>
                  <td className="f-mono py-2 pr-4 text-[0.72rem] text-cream-400">
                    {g.grantedAt.slice(0, 10)}
                    <span className="block" style={{ color: "var(--ink-faint)" }}>
                      by {g.grantedBy}
                    </span>
                  </td>
                  <td className="f-mono py-2 pr-4 text-[0.72rem] text-cream-400">
                    {g.expiresAt ? g.expiresAt.slice(0, 10) : "no end date"}
                  </td>
                  <td className="py-2">
                    {g.live ? (
                      <button
                        type="button"
                        onClick={() => revoke(g.id)}
                        disabled={busy === g.id}
                        className="btn btn-ghost btn-sm"
                      >
                        {busy === g.id ? "Withdrawing…" : "Withdraw"}
                      </button>
                    ) : (
                      <span className="f-mono text-[0.72rem]" style={{ color: "var(--ink-faint)" }}>
                        {g.revokedAt
                          ? `withdrawn ${g.revokedAt.slice(0, 10)}${g.revokedBy ? ` by ${g.revokedBy}` : ""}`
                          : "expired"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
