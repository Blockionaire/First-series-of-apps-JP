import { NextRequest } from "next/server";
import { currentUser, anonId, bumpUsage, getUsage } from "@/lib/auth";
import { retrieve, anthropicClient, buildAskSystemPrompt, numberHits, MODEL } from "@/lib/ai";
import { guard, WINDOW } from "@/lib/ratelimit";
import { track } from "@/lib/analytics";
import { limit } from "@/lib/site-config";

export const maxDuration = 60;

/**
 * The quotas, and the platform-wide ceiling.
 *
 * These were constants here. They are settings now — editable at
 * /admin/settings — because they are a pricing decision rather than an
 * engineering one, and because the ceiling is the only thing standing between
 * a free launch and an unbounded model bill. lib/site-config.ts clamps every
 * one of them to a declared range on the way in and on the way out, so a bad
 * row cannot lift the ceiling.
 *
 * On breach of the ceiling Ask STAI degrades to retrieval-only rather than
 * erroring: readers keep getting cited passages, the bill stops growing.
 */

/**
 * Streaming protocol: the first frame is a JSON envelope (sources + quota),
 * terminated by \x1e (record separator); everything after is answer text.
 */
export async function POST(req: NextRequest) {
  // Burst protection only — NOT a per-IP entitlement. A whole audit firm can
  // share one egress IP, so this must sit well above honest human use while
  // still stopping a script from looping the endpoint.
  const blocked = await guard(req, "ask", 15, WINDOW.tenMinutes);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "").trim().slice(0, 500);
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  if (question.length < 3) {
    return Response.json({ error: "Ask a real question" }, { status: 400 });
  }

  const user = await currentUser();
  const ANON_QUOTA = await limit("limit.ask.anon");
  const FREE_QUOTA = await limit("limit.ask.free");
  let quota = { used: 0, limit: -1 }; // -1 = unlimited
  if (!user) {
    const anon = await anonId();
    const used = await getUsage(`anon:${anon}`, "ask");
    if (used >= ANON_QUOTA) {
      return Response.json(
        { error: "quota", detail: "Free taste used up — create a free account for more, or go STAI+ for unlimited." },
        { status: 402 }
      );
    }
    quota = { used: await bumpUsage(`anon:${anon}`, "ask"), limit: ANON_QUOTA };
  } else if (user.plan !== "plus") {
    const used = await getUsage(`user:${user.id}`, "ask");
    if (used >= FREE_QUOTA) {
      return Response.json(
        { error: "quota", detail: "Your free questions for this month are used. STAI+ is unlimited." },
        { status: 402 }
      );
    }
    quota = { used: await bumpUsage(`user:${user.id}`, "ask"), limit: FREE_QUOTA };
  }

  // Counts a question. The question text itself is never stored.
  await track("ask_question", { path: "/ask" });

  const { numbered: hits, sources } = numberHits(await retrieve(question, 6));

  const envelope = JSON.stringify({ sources, quota }) + "\x1e";
  const encoder = new TextEncoder();

  // Cost stop: once the platform-wide monthly ceiling is reached we stop
  // calling the model entirely and serve cited passages instead.
  const globalCalls = await getUsage("global", "ask-model");
  const withinBudget = globalCalls < (await limit("limit.ask.ceiling"));
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
      await bumpUsage("global", "ask-model");
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
