"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SandboxCheckout({ plan }: { plan: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function complete() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Payment failed");
      router.push("/account?welcome=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={complete} disabled={busy} className="btn btn-plus premium-focus w-full">
        {busy ? "Processing…" : "Complete sandbox payment"}
      </button>
      {error && (
        <p role="alert" className="f-mono mt-2 text-[0.68rem] text-signal-down">
          {error}
        </p>
      )}
    </div>
  );
}
