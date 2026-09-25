import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { guard, WINDOW } from "@/lib/ratelimit";
import {
  candidateById,
  isFeedbackVerdict,
  recordDiscoveryFeedback,
} from "@/lib/newsroom/store";

/**
 * The dry run's actual output: a human's verdict on a selection.
 *
 * Two weeks of watching the engine pick things is worth little on its own.
 * Two weeks with "good story" or "wrong jurisdiction" beside each pick is a
 * labelled set that can tune the gates — and it only exists if it is captured
 * as the reviews happen. It cannot be reconstructed afterwards.
 *
 * Append-only. A reviewer who changes their mind adds a second row, because
 * the first judgement is also data: it says how clear the case was.
 */
export async function POST(req: NextRequest) {
  const blocked = await guard(req, "newsroom-feedback", 600, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const storyId = Number(b.storyId);
  if (!Number.isInteger(storyId) || storyId <= 0) {
    return NextResponse.json({ error: "A story id is required" }, { status: 400 });
  }

  const verdict = String(b.verdict ?? "");
  if (!isFeedbackVerdict(verdict)) {
    return NextResponse.json({ error: `Unknown verdict: ${verdict}` }, { status: 400 });
  }

  const story = await candidateById(storyId);
  if (!story) return NextResponse.json({ error: "No such story" }, { status: 404 });

  await recordDiscoveryFeedback({
    storyId,
    verdict,
    note: String(b.note ?? ""),
    reviewer: user.email,
  });

  return NextResponse.json({ ok: true });
}
