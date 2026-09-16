import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { invalidateSearchIndex } from "@/lib/search";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = await guard(req, "admin-article", 60, WINDOW.hour);
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
  const body_md = String(b.body_md ?? "");
  if (!slug || !title || !body_md.trim()) {
    return NextResponse.json({ error: "Slug, title and body are required" }, { status: 400 });
  }

  // Positional, in this exact order, for both statements below. D1 accepts
  // only `?` parameters, so the named form these used to carry is not
  // expressible — the order is now load-bearing.
  const values = [
    slug,
    title,
    String(b.dek ?? "").trim(),
    String(b.category ?? "Analysis"),
    JSON.stringify(
      String(b.tags ?? "")
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    ),
    String(b.author ?? "STAI Desk"),
    String(b.author_role ?? ""),
    /^\d{4}-\d{2}-\d{2}$/.test(String(b.published_at)) ? String(b.published_at) : new Date().toISOString().slice(0, 10),
    Math.max(1, Number(b.reading_min) || 6),
    Math.max(0, Math.min(4, Number(b.featured) || 0)),
    Math.max(1, Math.min(3, Number(b.urgency) || 2)),
    b.premium ? 1 : 0,
    b.status === "draft" ? "draft" : "published",
    body_md,
  ];

  let id = Number(b.id) || null;
  try {
    if (id) {
      // updated_at is what moves the Ask STAI corpus fingerprint. Without it
      // an edit is invisible to every isolate holding a cached index.
      await sql().run(
        `UPDATE articles SET slug=?, title=?, dek=?, category=?, tags=?, author=?,
         author_role=?, published_at=?, reading_min=?, featured=?,
         urgency=?, premium=?, status=?, body_md=?, updated_at=datetime('now') WHERE id=?`,
        [...values, id]
      );
    } else {
      const info = await sql().run(
        `INSERT INTO articles (slug, title, dek, category, tags, author, author_role, published_at, reading_min, featured, urgency, premium, status, body_md, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
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

  // Local fast path only. What actually guarantees Ask STAI picks this up is
  // the updated_at stamp above: every retrieval re-checks the corpus
  // fingerprint, so isolates this call can never reach still rebuild.
  invalidateSearchIndex();
  return NextResponse.json({ ok: true, id });
}
