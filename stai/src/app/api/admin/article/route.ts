import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";
import { NOW_MS } from "@/lib/now";
import { invalidateSearchIndex } from "@/lib/search";
import { guard, WINDOW } from "@/lib/ratelimit";
import { isArticleKind } from "@/lib/content";
import { pingIndexNow } from "@/lib/indexnow";

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

  // The section. Anything unrecognised files as news, which is where every
  // existing piece already sits — a bad value must not hide a published
  // article from both sections at once.
  const kind = isArticleKind(String(b.kind)) ? String(b.kind) : "news";

  // Positional, in this exact order, for both statements below. D1 accepts
  // only `?` parameters, so the named form these used to carry is not
  // expressible — the order is now load-bearing.
  const values = [
    slug,
    title,
    String(b.dek ?? "").trim(),
    String(b.category ?? "Analysis"),
    kind,
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
        `UPDATE articles SET slug=?, title=?, dek=?, category=?, kind=?, tags=?, author=?,
         author_role=?, published_at=?, reading_min=?, featured=?,
         urgency=?, premium=?, status=?, body_md=?, updated_at=${NOW_MS} WHERE id=?`,
        [...values, id]
      );
    } else {
      const info = await sql().run(
        `INSERT INTO articles (slug, title, dek, category, kind, tags, author, author_role, published_at, reading_min, featured, urgency, premium, status, body_md, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW_MS})`,
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

  // Tell the participating search engines the piece moved.
  //
  // Only for published work: a draft's URL answers 404, and asking a crawler
  // to come and find that spends the domain's credibility for nothing. The
  // section index goes in alongside it because it genuinely changed too.
  //
  // Awaited, but it cannot fail the save — pingIndexNow never throws and is
  // bounded by its own timeout. The result rides along in the response so the
  // admin UI can eventually surface it; nothing depends on it today.
  const published = b.status !== "draft";
  const indexnow = published
    ? await pingIndexNow([`/briefing/${slug}`, kind === "insight" ? "/insights" : "/news"])
    : { ok: false as const, reason: "draft — not submitted" };

  return NextResponse.json({ ok: true, id, indexnow });
}
