"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelSubscription({ founding }: { founding: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function cancel() {
    setBusy(true);
    await fetch("/api/subscription/cancel", { method: "POST" });
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" className="f-mono text-[0.68rem] tracking-[0.1em] uppercase underline underline-offset-4" style={{ color: "var(--ink-faint)" }} onClick={() => setConfirming(true)}>
        Cancel membership
      </button>
    );
  }

  return (
    <div className="border p-4 rule-strong">
      <p className="text-sm text-cream-200">
        {founding
          ? "Cancelling releases your founding seat — the €12 rate cannot be reclaimed once the 200 are gone."
          : "Sure? Access ends immediately in this demo (at period end with live billing)."}
      </p>
      <div className="mt-3 flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>
          {busy ? "…" : "Yes, cancel"}
        </button>
        <button type="button" className="f-mono text-[0.68rem] uppercase tracking-[0.1em] text-cream-400" onClick={() => setConfirming(false)}>
          Keep it
        </button>
      </div>
    </div>
  );
}
