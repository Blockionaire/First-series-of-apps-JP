import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/sql";

export const dynamic = "force-dynamic";

/** Millisecond-resolution timestamp, as the article editor uses. */
const NOW_MS = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

/**
 * Only http(s), and only an absolute URL.
 *
 * The value is rendered as an href, so a `javascript:` or `data:` URL here
 * would be a stored cross-site scripting hole reachable from a public page.
 * An empty string is allowed and means "no audio linked yet", which the hub
 * states plainly rather than rendering a dead control.
 */
function safeAudioUrl(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const slug = String(b.slug ?? "").trim();
  const title = String(b.title ?? "").trim();
  if (!slug || !title) {
    return NextResponse.json({ error: "Slug and title are required" }, { status: 400 });
  }

  const audio = safeAudioUrl(b.audio_url);
  if (audio === null) {
    return NextResponse.json(
      { error: "The episode link must be a full http(s) address, or empty" },
      { status: 400 }
    );
  }

  // Positional, in this exact order, for both statements below.
  const values = [
    slug,
    Math.max(1, Number(b.episode_no) || 1),
    title,
    String(b.guest ?? "").trim(),
    String(b.description ?? "").trim(),
    Math.max(1, Number(b.duration_min) || 30),
    /^\d{4}-\d{2}-\d{2}$/.test(String(b.published_at))
      ? String(b.published_at)
      : new Date().toISOString().slice(0, 10),
    audio,
    b.status === "draft" ? "draft" : "published",
  ];

  const id = Number(b.id) || null;
  try {
    if (id) {
      await sql().run(
        `UPDATE podcasts SET slug=?, episode_no=?, title=?, guest=?, description=?,
         duration_min=?, published_at=?, audio_url=?, status=?, updated_at=${NOW_MS} WHERE id=?`,
        [...values, id]
      );
      return NextResponse.json({ ok: true, id });
    }
    const row = await sql().first<{ id: number }>(
      `INSERT INTO podcasts (slug, episode_no, title, guest, description, duration_min, published_at, audio_url, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW_MS}) RETURNING id`,
      values
    );
    return NextResponse.json({ ok: true, id: row?.id ?? null });
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) {
      return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save the episode" }, { status: 500 });
  }
}
