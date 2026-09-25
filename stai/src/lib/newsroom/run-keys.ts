/**
 * How a run identifies itself, and how a day is named.
 *
 * Two pure functions, in their own module because the orchestrator that uses
 * them imports the database seam and therefore cannot be loaded outside a
 * running application. These are exactly the parts worth testing directly:
 * getting either wrong is silent.
 */

/**
 * The run's identity: one per invocation, never shared.
 *
 * `newsroom_pipeline_runs.idempotency_key` is UNIQUE. It used to be bucketed
 * to the hour so that a retry "reused the row" — which in practice meant a
 * second run in the same hour re-armed the first run's row and overwrote its
 * status and error. A run that failed at 09:05 and was re-run at 09:20 left
 * one row saying "succeeded" (CODE_AUDIT.md M2). Overlap is now the lease's
 * job (discovery.ts, claimRun), not the key's, so every invocation gets its
 * own row and a failure stays on the record.
 *
 * The timestamp keeps keys sortable and readable in the Inbox; the random
 * suffix makes two invocations in the same millisecond distinct.
 */
export function idempotencyKey(
  workflow: string,
  at = new Date(),
  nonce: string = globalThis.crypto.randomUUID().slice(0, 8)
): string {
  return `${workflow}:${at.toISOString()}:${nonce}`;
}

/**
 * The UTC day the research cap is applied over.
 *
 * UTC rather than local time so the cap does not shift when a reviewer
 * travels, and so two runs either side of midnight in Amsterdam do not each
 * get a full day's allowance.
 */
export const dayKey = (d = new Date()): string => d.toISOString().slice(0, 10);
