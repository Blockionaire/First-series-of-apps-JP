"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type EditorEpisode = {
  id: number | null;
  slug: string;
  episode_no: number;
  title: string;
  guest: string;
  description: string;
  duration_min: number;
  published_at: string;
  audio_url: string;
  status: string;
};

export default function PodcastEditor({ initial }: { initial: EditorEpisode }) {
  const [ep, setEp] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const set = <K extends keyof EditorEpisode>(k: K, v: EditorEpisode[K]) => {
    setEp((prev) => ({ ...prev, [k]: v }));
    setState("idle");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/admin/podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ep),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState("saved");
      if (!ep.id && json.id) setEp((prev) => ({ ...prev, id: json.id }));
      router.refresh();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Title</span>
          <input required className="input-stai mt-1.5 w-full" value={ep.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label>
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Slug</span>
          <input required className="input-stai f-mono mt-1.5 w-full text-[0.8rem]" value={ep.slug} onChange={(e) => set("slug", e.target.value)} />
        </label>
        <label>
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Episode number</span>
          <input type="number" min={1} className="input-stai mt-1.5 w-full" value={ep.episode_no} onChange={(e) => set("episode_no", Number(e.target.value))} />
        </label>
        <label>
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Guest</span>
          <input className="input-stai mt-1.5 w-full" value={ep.guest} onChange={(e) => set("guest", e.target.value)} />
        </label>
        <label>
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Published</span>
          <input type="date" className="input-stai mt-1.5 w-full" value={ep.published_at} onChange={(e) => set("published_at", e.target.value)} />
        </label>
        <label>
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Duration (minutes)</span>
          <input type="number" min={1} className="input-stai mt-1.5 w-full" value={ep.duration_min} onChange={(e) => set("duration_min", Number(e.target.value))} />
        </label>
        <label>
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Status</span>
          <select className="input-stai mt-1.5 w-full" value={ep.status} onChange={(e) => set("status", e.target.value)}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Episode link</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://…"
            className="input-stai f-mono mt-1.5 w-full text-[0.8rem]"
            value={ep.audio_url}
            onChange={(e) => set("audio_url", e.target.value)}
          />
          <span className="mt-1 block text-[0.75rem]" style={{ color: "var(--ink-faint)" }}>
            The episode page on whichever host you publish to — Spotify, Buzzsprout, Transistor. That host
            also produces the RSS feed Apple and Spotify subscribe to. Leave empty while the show notes are up
            but the audio is not; the hub says so rather than showing a dead button.
          </span>
        </label>
        <label className="sm:col-span-2">
          <span className="f-label" style={{ color: "var(--ink-muted)" }}>Show notes</span>
          <textarea rows={6} className="input-stai mt-1.5 w-full" value={ep.description} onChange={(e) => set("description", e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state === "busy"} className="btn btn-primary">
          {state === "busy" ? "Saving…" : "Save episode"}
        </button>
        {state === "saved" && (
          <p role="status" className="f-mono text-[0.72rem]" style={{ color: "var(--color-signal-up)" }}>
            Saved
          </p>
        )}
        {state === "error" && (
          <p role="status" className="f-mono text-[0.72rem]" style={{ color: "var(--color-signal-down)" }}>
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
