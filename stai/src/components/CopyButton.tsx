"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy prompt" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API unavailable (very old browsers) — fall back to selection
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <button type="button" onClick={copy} className="btn btn-primary" aria-live="polite">
      {done ? "Copied ✓" : label}
    </button>
  );
}
