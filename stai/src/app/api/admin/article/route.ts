import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateSearchIndex } from "@/lib/search";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "admin-article", 60, WINDOW.hour);
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

  const row = {
    slug,
    title,
    dek: String(b.dek ?? "").trim(),
    category: String(b.category ?? "Analysis"),
    tags: JSON.stringify(
      String(b.tags ?? "")
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    ),
    author: String(b.author ?? "STAI Desk"),
    author_role: String(b.author_role ?? ""),
    published_at: /^\d{4}-\d{2}-\d{2}$/.test(String(b.published_at)) ? String(b.published_at) : new Date().toISOString().slice(0, 10),
    reading_min: Math.max(1, Number(b.reading_min) || 6),
    featured: Math.max(0, Math.min(4, Number(b.featured) || 0)),
    urgency: Math.max(1, Math.min(3, Number(b.urgency) || 2)),
    premium: b.premium ? 1 : 0,
    status: b.status === "draft" ? "draft" : "published",
    body_md,
  };

  const d = db();
  let id = Number(b.id) || null;
  try {
    if (id) {
      d.prepare(
        `UPDATE articles SET slug=@slug, title=@title, dek=@dek, category=@category, tags=@tags, author=@author,
         author_role=@author_role, published_at=@published_at, reading_min=@reading_min, featured=@featured,
         urgency=@urgency, premium=@premium, status=@status, body_md=@body_md WHERE id=@id`
      ).run({ ...row, id });
    } else {
      const info = d
        .prepare(
          `INSERT INTO articles (slug, title, dek, category, tags, author, author_role, published_at, reading_min, featured, urgency, premium, status, body_md)
           VALUES (@slug, @title, @dek, @category, @tags, @author, @author_role, @published_at, @reading_min, @featured, @urgency, @premium, @status, @body_md)`
        )
        .run(row);
      id = Number(info.lastInsertRowid);
    }
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) {
      return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
    }
    throw e;
  }

  // Ask STAI grounding and briefing search pick the change up immediately.
  invalidateSearchIndex();
  return NextResponse.json({ ok: true, id });
}
