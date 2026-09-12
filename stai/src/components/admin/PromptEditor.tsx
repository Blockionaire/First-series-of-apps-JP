"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


// EditorPrompt and blankPrompt() live in lib/admin/prompts.ts, not here: every
// export of a "use client" module is a client reference, so a server component
// calling a helper defined in this file fails at request time.
import type { EditorPrompt } from "@/lib/admin/prompts";

export default function PromptEditor({
  initial,
  categories,
}: {
  initial: EditorPrompt;
  categories: string[];
}) {
  const [p, setP] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const set = <K extends keyof EditorPrompt>(k: K, v: EditorPrompt[K]) =>
    setP((prev) => ({ ...prev, [k]: v }));

  // Placeholders actually used in the body, so the editor can show what the
  // prompt really needs rather than only what was typed in the field.
  const inBody = Array.from(new Set(p.body.match(/\{\{\s*[\w.-]+\s*\}\}/g) ?? [])).map((m) =>
    m.replace(/[{}]/g, "").trim()
  );
  const declared = p.variables
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const undeclared = inBody.filter((v) => !declared.includes(v));

  async function save(next?: Partial<EditorPrompt>) {
    const payload = { ...p, ...next };
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/admin/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setP({ ...payload, id: payload.id ?? j.id });
      setState("saved");
      if (!p.id) router.push(`/admin/prompts/${j.id}`);
      else router.refresh();
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  const published = p.status === "published";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pe-title">
            Title
          </label>
          <input
            id="pe-title"
            required
            className="input-stai mt-1.5"
            value={p.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pe-desc">
            Description — what this prompt does, one or two sentences
          </label>
          <textarea
            id="pe-desc"
            required
            className="input-stai mt-1.5 min-h-16"
            value={p.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pe-slug">
            Slug
          </label>
          <input
            id="pe-slug"
            required
            className="input-stai f-mono mt-1.5 text-[0.8rem]"
            value={p.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
          <p className="f-mono mt-1 text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
            /prompts/{p.slug || "…"}
          </p>
        </div>

        <div>
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pe-cat">
            Category
          </label>
          <input
            id="pe-cat"
            required
            list="pe-categories"
            className="input-stai mt-1.5"
            value={p.category}
            onChange={(e) => set("category", e.target.value)}
          />
          <datalist id="pe-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="f-mono mt-1 text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
            Pick an existing one unless you mean to open a new shelf.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pe-vars">
            Variables (comma-separated, without braces)
          </label>
          <input
            id="pe-vars"
            className="input-stai f-mono mt-1.5 text-[0.8rem]"
            value={p.variables}
            onChange={(e) => set("variables", e.target.value)}
            placeholder="client_description, industry, developments"
          />
          {undeclared.length > 0 && (
            <p className="f-mono mt-1 text-[0.66rem] text-signal-down">
              Used in the body but not declared: {undeclared.join(", ")}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pe-note">
            Model note
          </label>
          <input
            id="pe-note"
            className="input-stai mt-1.5"
            value={p.model_note}
            onChange={(e) => set("model_note", e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-cream-200">
            <input
              type="checkbox"
              checked={p.premium}
              onChange={(e) => set("premium", e.target.checked)}
            />
            STAI+ only
          </label>
          <span className="f-mono text-[0.66rem]" style={{ color: "var(--ink-faint)" }}>
            {p.premium
              ? "Body is cut server-side for anyone without STAI+."
              : "Open to everyone, signed in or not."}
          </span>
        </div>
      </div>

      <div>
        <label className="f-label" style={{ color: "var(--ink-muted)" }} htmlFor="pe-body">
          Prompt body — write placeholders as {"{{variable_name}}"}
        </label>
        <textarea
          id="pe-body"
          required
          className="input-stai f-mono mt-1.5 min-h-[28rem] text-[0.8rem] leading-relaxed"
          value={p.body}
          onChange={(e) => set("body", e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={state === "busy"}>
          {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : published ? "Save" : "Save draft"}
        </button>

        {/* Publish / unpublish in one click. Unpublishing takes the prompt off
            every public surface; it never deletes anything. */}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={state === "busy"}
          onClick={() => void save({ status: published ? "draft" : "published" })}
        >
          {published ? "Unpublish" : "Publish now"}
        </button>

        <span
          className={`f-mono text-[0.66rem] tracking-[0.12em] uppercase ${
            published ? "text-signal-up" : "text-cream-400"
          }`}
        >
          {published ? "Live" : "Draft — not visible to readers"}
        </span>

        {state === "error" && (
          <p role="alert" className="f-mono text-[0.72rem] text-signal-down">
            {error}
          </p>
        )}

        {p.id && published && (
          <a
            href={`/prompts/${p.slug}`}
            className="f-mono text-[0.7rem] tracking-[0.1em] uppercase text-cream-400 underline underline-offset-4 hover:text-cream-100"
            target="_blank"
          >
            View live ↗
          </a>
        )}
      </div>
    </form>
  );
}
