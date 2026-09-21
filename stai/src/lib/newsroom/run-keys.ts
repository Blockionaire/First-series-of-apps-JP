/**
 * How a run identifies itself, and how a day is named.
 *
 * Two pure functions, in their own module because the orchestrator that uses
 * them imports the database seam and therefore cannot be loaded outside a
 * running application. These are exactly the parts worth testing directly:
 * getting either wrong is silent.
 */

/**
 * The run's identity, bucketed to the hour.
 *
 * `newsroom_pipeline_runs.idempotency_key` is UNIQUE, so two firings that
 * produce the same key share one row instead of racing to create two. The
 * hour is the right bucket: a cron retry seconds after the first attempt, or
 * an operator pressing "run now" during a scheduled run, are the same run.
 * Bucketing to the minute would make those two separate runs and lose the
 * protection exactly when it is needed.
 */
export function idempotencyKey(workflow: string, at = new Date()): string {
  return `${workflow}:${at.toISOString().slice(0, 13)}`;
}

/**
 * The UTC day the research cap is applied over.
 *
 * UTC rather than local time so the cap does not shift when a reviewer
 * travels, and so two runs either side of midnight in Amsterdam do not each
 * get a full day's allowance.
 */
export const dayKey = (d = new Date()): string => d.toISOString().slice(0, 10);
