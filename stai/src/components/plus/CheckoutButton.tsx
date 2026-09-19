"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutButton({
  plan,
  label,
  variant = "plus",
}: {
  plan: "monthly" | "annual" | "founding";
  label: string;
  variant?: "plus" | "plus-ghost";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json();
      if (res.status === 401) {
        router.push(j.next ?? "/signup?next=/plus");
        return;
      }
      if (!res.ok) throw new Error(j.error ?? "Checkout unavailable");
      if (j.url.startsWith("/")) router.push(j.url);
      else window.location.href = j.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout unavailable");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={`btn premium-focus w-full ${variant === "plus" ? "btn-plus" : "btn-plus-ghost"}`}
      >
        {busy ? "Opening checkout…" : label}
      </button>
      {error && (
        <p role="alert" className="f-mono mt-2 text-[0.68rem] text-signal-down">
          {error}
        </p>
      )}
    </div>
  );
}
