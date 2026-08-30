import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { bandFor } from "@/lib/assessment";
import { guard, WINDOW } from "@/lib/ratelimit";
import { computeBenchmark } from "@/lib/benchmark";

export async function POST(req: NextRequest) {
  const blocked = guard(req, "assessment", 10, WINDOW.hour);
  if (blocked) return blocked;

  const b = await req.json().catch(() => ({}));
  const answers = Array.isArray(b.answers) ? b.answers.map((n: unknown) => Number(n) || 0).slice(0, 12) : [];
  const score = Math.max(0, Math.min(24, Number(b.score) || 0));
  const band = String(b.band ?? "").slice(0, 20);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const firm = String(b.firm ?? "").trim().slice(0, 200);
  const firmSize = String(b.firmSize ?? "").trim().slice(0, 60);
  const jurisdiction = String(b.jurisdiction ?? "").trim().slice(0, 60);
  const role = String(b.role ?? "").trim().slice(0, 80);
  // The first call records the anonymous result; the second enriches it with
  // firm context. Passing the row id back avoids counting one firm twice in
  // the benchmark.
  const existingId = Number(b.id) || null;

  if (answers.length === 0) return NextResponse.json({ error: "No answers" }, { status: 400 });

  let id = existingId;
  if (id) {
    db()
      .prepare(
        "UPDATE assessments SET email=?, firm=?, firm_size=?, jurisdiction=?, role=? WHERE id=?"
      )
      .run(email, firm, firmSize, jurisdiction, role, id);
  } else {
    const info = db()
      .prepare(
        "INSERT INTO assessments (email, firm, answers, score, band, firm_size, jurisdiction, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(email, firm, JSON.stringify(answers), score, band, firmSize, jurisdiction, role);
    id = Number(info.lastInsertRowid);
  }

  const benchmark = computeBenchmark(score, firmSize);

  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const fullBand = bandFor(score);
    const peerLine = benchmark.ready
      ? `\nHow you compare: you scored ${score}/24. The median across ${benchmark.cohort} (n=${benchmark.sample}) is ${benchmark.median}/24 — you are at the ${benchmark.percentile}th percentile.\n`
      : `\nPeer benchmark: your response is now part of the dataset. Comparisons open once ${25} firms have taken part; we'll send yours when it does.\n`;
    await sendMail(
      email,
      `Your STAI AI-readiness result: ${fullBand.name} (${score}/24)`,
      `Your firm's AI-readiness band: ${fullBand.name} — ${score}/24.\n\n${fullBand.verdict}\n${peerLine}\nYour next three moves:\n${fullBand.moves
        .map((m, i) => `${i + 1}. ${m}`)
        .join("\n")}\n\nClose the gap before 2 August 2026 — programmes and firm-wide options: https://stai.ai/firms\n\n— STAI`
    );
  }

  return NextResponse.json({ ok: true, id, benchmark });
}
