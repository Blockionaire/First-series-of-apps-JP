import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import { sql, count } from "@/lib/sql";
import PodcastEditor, { type EditorEpisode } from "@/components/admin/PodcastEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Edit episode — admin",
  description: "STAI episode editor.",
  path: "/admin/podcast",
  noIndex: true,
});

export default async function EditEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/podcast");

  const { id } = await params;
  let initial: EditorEpisode;

  if (id === "new") {
    // One a week, numbered in sequence: default to the next number rather than
    // making someone look up where the run got to.
    const next = (await count("SELECT COALESCE(MAX(episode_no), 0) AS n FROM podcasts")) + 1;
    initial = {
      id: null,
      slug: "",
      episode_no: next,
      title: "",
      guest: "",
      description: "",
      duration_min: 32,
      published_at: new Date().toISOString().slice(0, 10),
      audio_url: "",
      status: "draft",
    };
  } else {
    const row = await sql().first<EditorEpisode & { id: number }>(
      "SELECT id, slug, episode_no, title, guest, description, duration_min, published_at, audio_url, status FROM podcasts WHERE id=?",
      [Number(id)]
    );
    if (!row) notFound();
    initial = row;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        <Link href="/admin/podcast" className="hover:text-cream-100">
          Podcast
        </Link>{" "}
        / {id === "new" ? "new" : `#${id}`}
      </p>
      <h1 className="f-display mt-2 mb-8 text-3xl text-cream-100">
        {id === "new" ? "New episode" : "Edit episode"}
      </h1>
      <PodcastEditor initial={initial} />
    </div>
  );
}
