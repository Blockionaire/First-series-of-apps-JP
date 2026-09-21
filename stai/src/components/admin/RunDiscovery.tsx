"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Run discovery now."
 *
 * Exists so the dry run can be started and inspected without waiting for a
 * cron tick, and so an operator who has just approved a source can see
 * whether its feed actually resolves.
 *
 * `force` skips the per-source cadence only. Activation and retrieval
 * permission have no override and are checked inside the fetcher, so this
 * button cannot cause a request to a source nobody approved.
 */
export default function RunDiscovery() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setState("running");
    setMessage("");
    try {
      const res = await fetch("/api/newsroom/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState("done");
      setMessage(
        `${json.itemsIngested} new item${json.itemsIngested === 1 ? "" : "s"} · ` +
          `${json.storiesCreated} new ${json.storiesCreated === 1 ? "story" : "stories"}, ` +
          `${json.storiesUpdated} updated · ${json.qualified} qualified, ` +
          `${json.selected} would go to research (cap ${json.cap})`
      );
      router.refresh();
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Discovery failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={state === "running"} className="btn btn-primary btn-sm">
        {state === "running" ? "Running…" : "Run discovery now"}
      </button>
      {message && (
        <span
          className="f-mono text-[0.72rem]"
          style={{ color: state === "error" ? "var(--danger, #d88)" : "var(--ink-muted)" }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
