import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { promptBySlug, bumpPromptUses } from "@/lib/content";
import { anthropicClient, buildAdaptSystemPrompt, fallbackAdapt, MODEL } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan !== "plus") {
    return NextResponse.json({ error: "Adapt-with-AI is a STAI+ feature" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = promptBySlug(String(body.slug ?? ""));
  if (!prompt) return NextResponse.json({ error: "Unknown prompt" }, { status: 404 });

  const ctx = {
    client: String(body.client ?? "").slice(0, 300),
    sector: String(body.sector ?? "").slice(0, 120),
    jurisdiction: String(body.jurisdiction ?? "").slice(0, 120),
    framework: String(body.framework ?? "").slice(0, 160),
    situation: String(body.situation ?? "").slice(0, 1200),
  };
  if (!Object.values(ctx).some(Boolean)) {
    return NextResponse.json({ error: "Give the panel at least one context field to work with" }, { status: 400 });
  }

  bumpPromptUses(prompt.id);

  const client = anthropicClient();
  if (!client) {
    const { adapted, rationale } = fallbackAdapt(prompt.body, ctx);
    return NextResponse.json({ adapted, rationale, engine: "offline" });
  }

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: buildAdaptSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `BASE PROMPT (title: "${prompt.title}", category: ${prompt.category}):\n\n${prompt.body}\n\nENGAGEMENT CONTEXT:\n- Client: ${ctx.client || "—"}\n- Sector: ${ctx.sector || "—"}\n- Jurisdiction: ${ctx.jurisdiction || "—"}\n- Framework/standards: ${ctx.framework || "—"}\n- Situation: ${ctx.situation || "—"}\n\nAdapt the base prompt to this context.`,
        },
      ],
    });
    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const adaptedMatch = text.match(/===ADAPTED PROMPT===\s*([\s\S]*?)\s*===WHAT CHANGED===/);
    const changedMatch = text.match(/===WHAT CHANGED===\s*([\s\S]*)$/);
    const adapted = adaptedMatch?.[1]?.trim() ?? text.trim();
    const rationale = (changedMatch?.[1] ?? "")
      .split("\n")
      .map((l) => l.replace(/^[-•*\d.\s]+/, "").trim())
      .filter((l) => l.length > 3);
    return NextResponse.json({ adapted, rationale, engine: "ai" });
  } catch {
    const { adapted, rationale } = fallbackAdapt(prompt.body, ctx);
    return NextResponse.json({ adapted, rationale, engine: "offline" });
  }
}
