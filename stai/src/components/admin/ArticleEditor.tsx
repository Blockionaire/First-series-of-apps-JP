"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type EditorArticle = {
  id: number | null;
  slug: string;
  title: string;
  dek: string;
  category: string;
  tags: string;
  author: string;
  author_role: string;
  published_at: string;
  reading_min: number;
  featured: number;
  urgency: number;
  premium: boolean;
  status: string;
  body_md: string;
};

const CATEGORIES = ["Regulation", "Analysis", "Practice", "Tools", "News"];

export default function ArticleEditor({ initial }: { initial: EditorArticle }) {
  const [a, setA] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const set = <K extends keyof EditorArticle>(k: K, v: EditorArticle[K]) => setA((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/admin/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setState("saved");
      if (!a.id) router.push(`/admin/content/${j.id}`);
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-title">
            Title
          </label>
          <input id="ed-title" required className="input-stai mt-1.5" value={a.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-dek">
            Dek (standfirst)
          </label>
          <textarea id="ed-dek" required className="input-stai mt-1.5 min-h-16" value={a.dek} onChange={(e) => set("dek", e.target.value)} />
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-slug">
            Slug
          </label>
          <input id="ed-slug" required className="input-stai f-mono mt-1.5 text-[0.8rem]" value={a.slug} onChange={(e) => set("slug", e.target.value)} />
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-cat">
            Category
          </label>
          <select id="ed-cat" className="input-stai mt-1.5" value={a.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-author">
            Author
          </label>
          <input id="ed-author" className="input-stai mt-1.5" value={a.author} onChange={(e) => set("author", e.target.value)} />
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-role">
            Author role
          </label>
          <input id="ed-role" className="input-stai mt-1.5" value={a.author_role} onChange={(e) => set("author_role", e.target.value)} />
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-date">
            Published (YYYY-MM-DD)
          </label>
          <input id="ed-date" className="input-stai f-mono mt-1.5 text-[0.8rem]" value={a.published_at} onChange={(e) => set("published_at", e.target.value)} />
        </div>
        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-tags">
            Tags (comma-separated)
          </label>
          <input id="ed-tags" className="input-stai mt-1.5" value={a.tags} onChange={(e) => set("tags", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-4 sm:col-span-2">
          <div>
            <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-min">
              Reading min
            </label>
            <input id="ed-min" type="number" min={1} className="input-stai mt-1.5" value={a.reading_min} onChange={(e) => set("reading_min", Number(e.target.value))} />
          </div>
          <div>
            <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-feat">
              Featured slot (0 = none, 1 = lead)
            </label>
            <input id="ed-feat" type="number" min={0} max={4} className="input-stai mt-1.5" value={a.featured} onChange={(e) => set("featured", Number(e.target.value))} />
          </div>
          <div>
            <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-urg">
              Urgency (1–3)
            </label>
            <input id="ed-urg" type="number" min={1} max={3} className="input-stai mt-1.5" value={a.urgency} onChange={(e) => set("urgency", Number(e.target.value))} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-cream-200">
            <input type="checkbox" checked={a.premium} onChange={(e) => set("premium", e.target.checked)} />
            STAI+ only
          </label>
          <label className="flex items-center gap-2 text-sm text-cream-200">
            <input type="checkbox" checked={a.status === "published"} onChange={(e) => set("status", e.target.checked ? "published" : "draft")} />
            Published
          </label>
        </div>
      </div>

      <div>
        <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="ed-body">
          Body (markdown)
        </label>
        <textarea
          id="ed-body"
          required
          className="input-stai f-mono mt-1.5 min-h-[28rem] text-[0.8rem] leading-relaxed"
          value={a.body_md}
          onChange={(e) => set("body_md", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={state === "busy"}>
          {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save & publish"}
        </button>
        {state === "error" && (
          <p role="alert" className="f-mono text-[0.72rem] text-signal-down">
            {error}
          </p>
        )}
        {a.id && a.status === "published" && (
          <a href={`/briefing/${a.slug}`} className="f-mono text-[0.7rem] tracking-[0.1em] uppercase text-cream-400 underline underline-offset-4 hover:text-cream-100" target="_blank">
            View live ↗
          </a>
        )}
      </div>
    </form>
  );
}
