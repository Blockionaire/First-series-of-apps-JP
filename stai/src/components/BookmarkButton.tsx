"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookmarkButton({
  kind,
  refId,
  initial,
  authed,
}: {
  kind: "article" | "prompt";
  refId: number;
  initial: boolean;
  authed: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (!authed) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, refId }),
      });
      if (res.ok) {
        const j = await res.json();
        setSaved(j.saved);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className={`f-mono inline-flex items-center gap-2 border px-3 py-2 text-[0.68rem] tracking-[0.12em] uppercase transition-colors ${
        saved ? "border-cream-400 text-cream-100" : "rule-strong text-cream-400 hover:text-cream-100"
      }`}
    >
      <span aria-hidden>{saved ? "■" : "□"}</span>
      {saved ? "Saved to desk" : "Save to desk"}
    </button>
  );
}
