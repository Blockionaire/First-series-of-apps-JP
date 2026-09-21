/**
 * The scheduled discovery run, called straight from the Worker's
 * `scheduled()` handler.
 *
 * ── Why this module exists ──────────────────────────────────────────────
 * `worker/entry.ts` is excluded from tsconfig.json — it imports a build
 * artefact that does not exist on a clean checkout — so it is the one file
 * the compiler never sees. Every line of logic that would otherwise sit there
 * lives here instead, where it is typechecked, and entry.ts keeps its single
 * job of re-exporting and delegating.
 *
 * ── Why the driver is registered here ───────────────────────────────────
 * An earlier version had `scheduled()` POST to a public route carrying a
 * shared secret, because `lib/sql-workers.ts` obtains the D1 binding through
 * `getCloudflareContext()`, and that context is REQUEST-SCOPED: a cron
 * invocation has no request, so the ambient lookup finds nothing.
 *
 * But `scheduled()` is handed `env` directly. So the fix is not an HTTP hop —
 * it is a driver that prefers the ambient context and falls back to the
 * environment the cron invocation was given. That removes a publicly
 * reachable endpoint and a secret to manage, which is a smaller surface than
 * either.
 *
 * The ambient context is tried FIRST, deliberately. This factory replaces the
 * one instrumentation.ts installed, and the isolate that ran a cron job will
 * go on to serve HTTP requests; those must keep reading the binding from their
 * own request, not from an env object captured during a cron run minutes
 * earlier.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { registerD1Sql, type D1Database } from "../sql-d1";
import { isEnabled } from "../site-config";
import { runDiscovery, type DiscoveryResult } from "./discovery.ts";

export type CronEnv = { DB?: D1Database };

/**
 * The environment of the most recent scheduled invocation.
 *
 * Module-level and mutable, which is normally the wrong shape on Workers —
 * but this is only ever a FALLBACK, consulted when there is no request to read
 * from, and it is refreshed at the start of every scheduled run. A stale value
 * can therefore only be reached by a cron invocation that supplied no env of
 * its own, which cannot happen.
 */
let cronEnv: CronEnv | null = null;

/**
 * Install the driver. Called on EVERY scheduled run, deliberately.
 *
 * An earlier version guarded this with a module-level `installed` flag, which
 * introduced an ordering bug: Next's instrumentation hook also registers a
 * driver — the OpenNext-only one — and it runs at server init, which may be
 * after a cron has already fired in the same isolate. The flag would then skip
 * re-installation, leaving the request-scoped factory in place, and the next
 * scheduled run would fail looking for a request context that does not exist.
 *
 * Registration is a single assignment and the factory below is strictly more
 * capable than the one it replaces — it prefers the ambient context and only
 * falls back — so doing it every time is both cheap and the safe order.
 */
function installDriver(): void {
  registerD1Sql(() => {
    try {
      const env = getCloudflareContext().env as unknown as CronEnv;
      if (env?.DB) return env.DB;
    } catch {
      // No request context. Expected inside a scheduled invocation, and the
      // only reason the fallback below exists.
    }
    if (cronEnv?.DB) return cronEnv.DB;

    throw new Error(
      "D1 binding `DB` is missing in the scheduled context. Check the d1_databases " +
        "entry in wrangler.jsonc. There is no filesystem fallback on Workers."
    );
  });
}

export type ScheduledOutcome =
  | { ran: true; result: DiscoveryResult }
  | { ran: false; reason: string };

/**
 * Run discovery on a schedule. Never throws.
 *
 * A cron handler that throws produces a retry and a log line nobody reads. The
 * run records its own failure in `newsroom_pipeline_runs` before this returns,
 * so a failed run is visible in the Editorial Inbox rather than as a gap.
 *
 * Discovery is OFF by default (`page.discovery.enabled`). The trigger can
 * therefore be deployed before anyone has approved a single source, and it
 * will do nothing until an operator switches it on — which is the same rule
 * the source registry follows, applied to the schedule.
 */
export async function runScheduledDiscovery(env: CronEnv): Promise<ScheduledOutcome> {
  cronEnv = env;
  installDriver();

  try {
    if (!(await isEnabled("discovery"))) {
      return { ran: false, reason: "discovery is switched off in site settings" };
    }
  } catch (e) {
    // Reading the setting needs the database. If that fails there is no point
    // attempting the run, and the reason is worth naming precisely.
    return {
      ran: false,
      reason: `could not read settings: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    // No `force`: the per-source cadence is what keeps this polite. The
    // trigger fires every thirty minutes; most sources are not due on most
    // firings, and that is the intent.
    const result = await runDiscovery();
    return { ran: true, result };
  } catch (e) {
    return { ran: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** One line for the Worker log, so a run leaves a readable trace. */
export function describeOutcome(outcome: ScheduledOutcome): string {
  if (!outcome.ran) return `[newsroom] discovery skipped: ${outcome.reason}`;
  const r = outcome.result;
  return (
    `[newsroom] discovery run ${r.runId}: ${r.itemsIngested} new, ${r.itemsRevised} revised, ` +
    `${r.storiesCreated} stories created, ${r.storiesUpdated} updated, ` +
    `${r.qualified} qualified, ${r.selected} would research (cap ${r.cap})`
  );
}
