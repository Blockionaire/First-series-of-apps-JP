import { getCloudflareContext } from "@opennextjs/cloudflare";
import { registerD1Sql, type D1Database } from "./sql-d1";

/**
 * Install the D1 driver on Cloudflare Workers.
 *
 * The one module that connects the application's database seam to a Cloudflare
 * binding. It exists separately from sql-d1.ts so that the D1 *implementation*
 * stays free of any OpenNext import and remains unit-testable with a plain
 * object, while this file — which genuinely needs the runtime — is the only
 * place that reaches for the ambient context.
 *
 * The binding is read PER CALL, not captured once. On Workers the environment
 * belongs to the request, and a value frozen at module scope is wrong on the
 * second request and absent on a cold isolate.
 */
export function registerWorkersSql(): void {
  registerD1Sql(() => {
    const env = getCloudflareContext().env as unknown as { DB?: D1Database };
    const db = env?.DB;
    if (!db) {
      // Fail loudly and specifically. The alternative — quietly falling back
      // to a file database — is not available on Workers at all, and if it
      // were it would be worse: the site would appear to work while writing
      // to storage that disappears with the isolate.
      throw new Error(
        "D1 binding `DB` is missing. Check the d1_databases entry in wrangler.jsonc. " +
          "There is no filesystem fallback on Workers, and there must never be one."
      );
    }
    return db;
  });
}
