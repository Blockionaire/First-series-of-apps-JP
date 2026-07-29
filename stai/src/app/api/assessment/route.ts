import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { bandFor } from "@/lib/assessment";
import { guard, WINDOW } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "assessment", 10, WINDOW.hour);
  if (blocked) return blocked;

  const b = await req.json().catch(() => ({}));
  const answers = Array.isArray(b.answers) ? b.answers.map((n: unknown) => Number(n) || 0).slice(0, 12) : [];
  const score = Math.max(0, Math.min(24, Number(b.score) || 0));
  const band = String(b.band ?? "").slice(0, 20);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const firm = String(b.firm ?? "").trim().slice(0, 200);

  if (answers.length === 0) return NextResponse.json({ error: "No answers" }, { status: 400 });

  db()
    .prepare("INSERT INTO assessments (email, firm, answers, score, band) VALUES (?, ?, ?, ?, ?)")
    .run(email, firm, JSON.stringify(answers), score, band);

  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const fullBand = bandFor(score);
    await sendMail(
      email,
      `Your STAI AI-readiness result: ${fullBand.name} (${score}/24)`,
      `Your firm's AI-readiness band: ${fullBand.name} — ${score}/24.\n\n${fullBand.verdict}\n\nYour next three moves:\n${fullBand.moves
        .map((m, i) => `${i + 1}. ${m}`)
        .join("\n")}\n\nClose the gap before 2 August 2026 — training programmes and the full playbook: https://stai.ai/training\n\n— STAI`
    );
  }

  return NextResponse.json({ ok: true });
}
