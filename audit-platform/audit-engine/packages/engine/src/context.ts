import { createHash, randomUUID } from "node:crypto";
import type { DataClass, RunManifest, StageRecord } from "@audit/domain";
import { SCHEMA_VERSION } from "@audit/domain";
import type { MethodologyPack } from "@audit/methodology";
import type { LlmClient, LlmResult } from "./llm.ts";

export const PROMPT_VERSION = "0.1.0";

export function hash(input: unknown): string {
  return createHash("sha256")
    .update(typeof input === "string" ? input : JSON.stringify(input))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Everything environmental a stage needs. No stage reaches for a global, an environment
 * variable or the filesystem — which is what lets the same engine be called from a CLI now
 * and from a web request, a questionnaire or a live cockpit later (07 §7.1).
 */
export class EngineContext {
  readonly runId: string;
  readonly startedAt: string;
  private readonly stages: StageRecord[] = [];

  constructor(
    readonly pack: MethodologyPack,
    readonly llm: LlmClient,
    readonly caseId: string,
    readonly engagementId: string,
    readonly sourceClass: DataClass,
    readonly clientProfile: string | null,
  ) {
    this.runId = `run_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
    this.startedAt = new Date().toISOString();
  }

  record(stage: string, promptHash: string, inputHash: string, result: LlmResult<unknown>): void {
    this.stages.push({
      stage,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      promptHash,
      inputHash,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      ok: true,
      error: null,
    });
  }

  recordFailure(stage: string, error: unknown): void {
    this.stages.push({
      stage, model: "-", promptVersion: PROMPT_VERSION, promptHash: "-", inputHash: "-",
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
      costUsd: 0, latencyMs: 0, ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  manifest(): RunManifest {
    return {
      runId: this.runId,
      caseId: this.caseId,
      engagementId: this.engagementId,
      packVersion: this.pack.version,
      schemaVersion: SCHEMA_VERSION,
      sourceClass: this.sourceClass,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      stages: this.stages,
      totalCostUsd: this.stages.reduce((n, s) => n + s.costUsd, 0),
      totalLatencyMs: this.stages.reduce((n, s) => n + s.latencyMs, 0),
    };
  }
}
