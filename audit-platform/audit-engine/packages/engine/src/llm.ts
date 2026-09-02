import { z } from "zod";

/**
 * The single seam between the engine and a model provider.
 *
 * Phase 0-1 run against the first-party Claude API on synthetic and anonymised data
 * (class C0/C1). Real client data (C3) requires EU-resident inference, which is a
 * different implementation of this interface and no change anywhere else (07 §7.2).
 */

export type ModelKey = "reasoning" | "extraction" | "cheap";

export const MODELS: Record<ModelKey, string> = {
  reasoning: "claude-opus-5",
  extraction: "claude-sonnet-5",
  cheap: "claude-haiku-4-5",
};

/** USD per million tokens, list price. Used for the run manifest, not for billing. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LlmResult<T> {
  value: T;
  model: string;
  usage: Usage;
  costUsd: number;
  latencyMs: number;
}

export interface GenerateOptions<T extends z.ZodTypeAny> {
  model: ModelKey;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  /** Stable across every call in a run — the cached prefix (06 §6.4). */
  systemBlocks: string[];
  /** Volatile, per call. */
  userBlocks: string[];
  schema: T;
  maxTokens?: number;
}

export interface LlmClient {
  generate<T extends z.ZodTypeAny>(opts: GenerateOptions<T>): Promise<LlmResult<z.infer<T>>>;
}

export function costOf(model: string, usage: Usage): number {
  const p = PRICING[model] ?? { input: 5, output: 25 };
  // Cached reads bill at roughly a tenth of base input; writes at ~1.25x.
  const input =
    (usage.inputTokens * p.input +
      usage.cacheReadTokens * p.input * 0.1 +
      usage.cacheWriteTokens * p.input * 1.25) /
    1_000_000;
  return input + (usage.outputTokens * p.output) / 1_000_000;
}

/* ── Anthropic implementation ─────────────────────────────────────────────── */

/**
 * NOTE — the one integration point in this package that a live API call has to confirm:
 * the exact shape of `output_config.format` produced by `zodOutputFormat`. Everything else
 * is exercised by the mock client and the unit tests. If the helper's import path or
 * signature differs in the installed SDK, this is the only file that changes.
 */
export class AnthropicLlmClient implements LlmClient {
  constructor(private readonly apiKey: string | undefined = process.env["ANTHROPIC_API_KEY"]) {}

  async generate<T extends z.ZodTypeAny>(opts: GenerateOptions<T>): Promise<LlmResult<z.infer<T>>> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const client = new Anthropic(this.apiKey ? { apiKey: this.apiKey } : {});
    const model = MODELS[opts.model];
    const started = Date.now();

    const system = opts.systemBlocks.map((text, i) => ({
      type: "text" as const,
      text,
      // cache breakpoint after the last stable block
      ...(i === opts.systemBlocks.length - 1
        ? { cache_control: { type: "ephemeral" as const } }
        : {}),
    }));

    const response = await client.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort, format: zodOutputFormat(opts.schema) },
      system,
      messages: [
        { role: "user", content: opts.userBlocks.map((text) => ({ type: "text" as const, text })) },
      ],
    } as never);

    const r = response as unknown as {
      parsed_output: unknown;
      usage?: Record<string, number | undefined>;
    };
    if (r.parsed_output == null) throw new Error(`Model returned no parseable output for ${model}`);

    const usage: Usage = {
      inputTokens: r.usage?.["input_tokens"] ?? 0,
      outputTokens: r.usage?.["output_tokens"] ?? 0,
      cacheReadTokens: r.usage?.["cache_read_input_tokens"] ?? 0,
      cacheWriteTokens: r.usage?.["cache_creation_input_tokens"] ?? 0,
    };

    return {
      value: opts.schema.parse(r.parsed_output),
      model,
      usage,
      costUsd: costOf(model, usage),
      latencyMs: Date.now() - started,
    };
  }
}

/* ── Mock, for tests and dry runs ─────────────────────────────────────────── */

export class MockLlmClient implements LlmClient {
  public readonly calls: GenerateOptions<z.ZodTypeAny>[] = [];
  constructor(private readonly responder: (opts: GenerateOptions<z.ZodTypeAny>) => unknown) {}

  async generate<T extends z.ZodTypeAny>(opts: GenerateOptions<T>): Promise<LlmResult<z.infer<T>>> {
    this.calls.push(opts as GenerateOptions<z.ZodTypeAny>);
    const raw = this.responder(opts as GenerateOptions<z.ZodTypeAny>);
    const usage: Usage = { inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 };
    return {
      value: opts.schema.parse(raw),
      model: MODELS[opts.model],
      usage,
      costUsd: costOf(MODELS[opts.model], usage),
      latencyMs: 1,
    };
  }
}
