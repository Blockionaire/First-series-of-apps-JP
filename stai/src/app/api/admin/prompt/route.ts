import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { guard, WINDOW } from "@/lib/ratelimit";

/**
 * Prompt Library CMS write endpoint — the counterpart of /api/admin/article.
 *
 * POST only, and deliberately so. There is no DELETE handler and no delete
 * branch: a prompt that should stop being public is set to `status: "draft"`,
 * which takes it off every public surface while keeping the text, the slug and
 * its usage history. Prompts are linked to and cited; a hard delete turns a
 * shared link into a 404 with nothing to recover.
 *
 * The database is the source of truth for premium/free gating. Nothing here
 * consults src/lib/seed/gating.ts, and no seed run overwrites what this writes
 * (see the slug ledger in src/lib/seed/run.ts).
 */
export async function POST(req: NextRequest) {
  const blocked = guard(req, "admin-prompt", 60, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const slug = String(b.slug ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const title = String(b.title ?? "").trim();
  const category = String(b.category ?? "").trim();
  const description = String(b.description ?? "").trim();
  const body = String(b.body ?? "");

  if (!slug || !title || !category || !description || !body.trim()) {
    return NextResponse.json(
      { error: "Slug, title, category, description and prompt body are all required" },
      { status: 400 }
    );
  }

  // Variables are placeholder names, written {{like_this}} in the body. Accept
  // them with or without the braces so a name can be pasted straight out of
  // the prompt text.
  const variables = String(b.variables ?? "")
    .split(",")
    .map((v: string) => v.trim().replace(/^\{\{|\}\}$/g, "").trim())
    .filter(Boolean);

  // Positional, in this exact order, for both statements below. D1 accepts
  // only `?` parameters, so the named form these used to carry is not
  // expressible — the order is now load-bearing.
  const values = [
    slug,
    title,
    category,
    description,
    body,
    JSON.stringify(variables),
    String(b.model_note ?? "").trim(),
    b.premium ? 1 : 0,
    b.status === "draft" ? "draft" : "published",
  ];
  const status = String(values[8]);

  let id = Number(b.id) || null;
  try {
    if (id) {
      const info = await sql().run(
        `UPDATE prompts SET slug=?, title=?, category=?, description=?,
         body=?, variables=?, model_note=?, premium=?, status=?,
         updated_at=datetime('now') WHERE id=?`,
        [...values, id]
      );
      if (info.changes === 0) {
        return NextResponse.json({ error: "That prompt no longer exists" }, { status: 404 });
      }
    } else {
      const info = await sql().run(
        `INSERT INTO prompts (slug, title, category, description, body, variables, model_note, premium, status, uses, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
        values
      );
      id = info.lastRowId;
    }
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) {
      return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
    }
    throw e;
  }

  // No invalidateSearchIndex() call here, and that is not an omission: the
  // BM25 index in src/lib/search.ts is built from articles only, so prompts do
  // not participate in Ask STAI grounding. Every public prompt surface is
  // force-dynamic and reads the database per request, so a save is live
  // immediately. If prompts are ever added to buildIndex(), this endpoint has
  // to invalidate — tests/prompt-cms.test.mjs fails loudly if that happens.
  return NextResponse.json({ ok: true, id, status });
}
