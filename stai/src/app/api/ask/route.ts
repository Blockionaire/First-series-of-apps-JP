import { NextRequest } from "next/server";
import { currentUser, anonId, bumpUsage, getUsage } from "@/lib/auth";
import { retrieve, anthropicClient, buildAskSystemPrompt, numberHits, MODEL } from "@/lib/ai";
import { guard, WINDOW } from "@/lib/ratelimit";

export const maxDuration = 60;

const FREE_QUOTA = 5;
const ANON_QUOTA = 2;

/**
 * Hard ceiling on model calls per calendar month across the whole platform.
 * The per-actor quotas above are the product gate; this is the cost stop.
 * On breach we degrade to retrieval-only rather than erroring — readers keep
 * getting cited answers, the bill stops growing.
 */
const GLOBAL_MONTHLY_CALLS = parseInt(process.env.ASK_MONTHLY_CALL_CEILING ?? "5000", 10);

/**
 * Streaming protocol: the first frame is a JSON envelope (sources + quota),
 * terminated by \x1e (record separator); everything after is answer text.
 */
export async function POST(req: NextRequest) {
  // Burst protection only — NOT a per-IP entitlement. A whole audit firm can
  // share one egress IP, so this must sit well above honest human use while
  // still stopping a script from looping the endpoint.
  const blocked = guard(req, "ask", 15, WINDOW.tenMinutes);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "").trim().slice(0, 500);
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  if (question.length < 3) {
    return Response.json({ error: "Ask a real question" }, { status: 400 });
  }

  const user = await currentUser();
  let quota = { used: 0, limit: -1 }; // -1 = unlimited
  if (!user) {
    const anon = await anonId();
    const used = getUsage(`anon:${anon}`, "ask");
    if (used >= ANON_QUOTA) {
      return Response.json(
        { error: "quota", detail: "Free taste used up — create a free account for more, or go STAI+ for unlimited." },
        { status: 402 }
      );
    }
    quota = { used: bumpUsage(`anon:${anon}`, "ask"), limit: ANON_QUOTA };
  } else if (user.plan !== "plus") {
    const used = getUsage(`user:${user.id}`, "ask");
    if (used >= FREE_QUOTA) {
      return Response.json(
        { error: "quota", detail: "Your free questions for this month are used. STAI+ is unlimited." },
        { status: 402 }
      );
    }
    quota = { used: bumpUsage(`user:${user.id}`, "ask"), limit: FREE_QUOTA };
  }

  const { numbered: hits, sources } = numberHits(retrieve(question, 6));

  const envelope = JSON.stringify({ sources, quota }) + "\x1e";
  const encoder = new TextEncoder();

  // Cost stop: once the platform-wide monthly ceiling is reached we stop
  // calling the model entirely and serve cited passages instead.
  const globalCalls = getUsage("global", "ask-model");
  const withinBudget = globalCalls < GLOBAL_MONTHLY_CALLS;
  const client = withinBudget ? anthropicClient() : null;

  if (!client || hits.length === 0) {
    // Retrieval-only mode: cited passages, honestly labelled. Never a dead feature.
    const text =
      hits.length === 0
        ? "The desk has nothing on that yet. Try the Briefing's search, or rephrase — Ask STAI only answers from STAI's own published research, and says so when the shelf is empty."
        : [
            "**Retrieval mode** — the AI composer isn't configured in this environment, so here are the desk's most relevant passages, cited the way a full answer would be:",
            ...hits.slice(0, 3).map((h) => {
              const excerpt = h.text.replace(/^#+\s.*$/gm, "").replace(/\*+/g, "").trim().split(/\n+/)[0];
              return `${excerpt.slice(0, 320)}${excerpt.length > 320 ? "…" : ""} [${h.n}]`;
            }),
            "Open a source to read the full analysis.",
          ].join("\n\n");
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(envelope));
        // paced chunks so the console's streaming affordance stays honest
        for (const chunk of text.match(/[\s\S]{1,80}/g) ?? []) {
          controller.enqueue(encoder.encode(chunk));
          await new Promise((r) => setTimeout(r, 24));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(envelope));
      bumpUsage("global", "ask-model");
      try {
        const msgStream = client.messages.stream({
          model: MODEL,
          max_tokens: 1200,
          system: buildAskSystemPrompt(hits),
          messages: [
            ...history.map((h: { role: string; content: string }) => ({
              role: (h.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
              content: String(h.content).slice(0, 2000),
            })),
            { role: "user" as const, content: question },
          ],
        });
        for await (const event of msgStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode("\n\n[The AI service dropped mid-answer — the citations above still point to the relevant sources.]")
        );
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
