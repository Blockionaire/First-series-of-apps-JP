import { db } from "../db";

/**
 * Admin-side prompt reads.
 *
 * Deliberately separate from lib/content.ts: those functions filter to
 * `status='published'` because they feed public pages, and the back office is
 * the one place that must see drafts. Keeping the two sets of queries in
 * different modules makes it hard to reach for the wrong one by accident.
 */

export type AdminPromptRow = {
  id: number;
  slug: string;
  title: string;
  category: string;
  premium: number;
  status: string;
  uses: number;
  updated_at: string | null;
};

export type AdminPromptFull = AdminPromptRow & {
  description: string;
  body: string;
  variables: string;
  model_note: string;
};

/**
 * Categories currently in use, taken from the data rather than a hard-coded
 * list: the library's shelves are an editorial decision, not a constant.
 */
export function promptCategories(): string[] {
  return (
    db().prepare("SELECT DISTINCT category FROM prompts ORDER BY category ASC").all() as {
      category: string;
    }[]
  ).map((r) => r.category);
}

export function adminPromptById(id: number): AdminPromptFull | null {
  const r = db().prepare("SELECT * FROM prompts WHERE id=?").get(id);
  return (r as AdminPromptFull | undefined) ?? null;
}

/**
 * The shape the editor form works in — `variables` flattened to a
 * comma-separated string, `premium` as a boolean.
 *
 * This and blankPrompt() live here rather than beside the editor component
 * because that component is "use client": every export of a client module
 * becomes a client reference, so a server component calling blankPrompt()
 * there throws at request time rather than at build time.
 */
export type EditorPrompt = {
  id: number | null;
  slug: string;
  title: string;
  category: string;
  description: string;
  body: string;
  variables: string;
  model_note: string;
  premium: boolean;
  status: string;
};

export const DEFAULT_MODEL_NOTE =
  "Tuned for Claude and GPT-class models; works in Copilot with the M365 context attached.";

/** A new prompt always starts as a draft — nothing reaches readers by accident. */
export function blankPrompt(category: string): EditorPrompt {
  return {
    id: null,
    slug: "",
    title: "",
    category,
    description: "",
    body: "",
    variables: "",
    model_note: DEFAULT_MODEL_NOTE,
    premium: false,
    status: "draft",
  };
}
