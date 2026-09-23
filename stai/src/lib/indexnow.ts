/**
 * IndexNow — telling search engines a URL changed, instead of waiting.
 *
 * A sitemap is a standing invitation; IndexNow is a knock on the door. One
 * POST names the URLs that changed and Bing, Yandex, Seznam and Naver share
 * the submission between them. Google does not participate, which is fine:
 * the point of this is the engines that do, and for a desk that publishes a
 * piece the day a regulation moves, the gap between "published" and
 * "crawled" is the whole value.
 *
 * ── How it is keyed ──────────────────────────────────────────────────────
 * Ownership is proved by hosting a file containing the key somewhere on the
 * host, and naming that location in the submission (`keyLocation`). The
 * protocol's default is `https://host/<key>.txt`; serving it from one fixed
 * path instead means rotating the key never leaves a stale file behind and
 * never needs a new route.
 *
 * The key is NOT a secret — it is published, by design, at that URL. It
 * still comes from the environment rather than from Git, because it is
 * deployment-specific: a preview deployment must not be able to submit URLs
 * for the production host.
 *
 * ── What it must never do ────────────────────────────────────────────────
 * Fail a publish. An editor pressing Save is doing editorial work, not
 * search-engine work, and a search engine having a bad afternoon is not a
 * reason to refuse an article. Every failure path here returns a reason and
 * throws nothing.
 */

import { SITE, abs, siteHost } from "./seo";

const ENDPOINT = "https://api.indexnow.org/IndexNow";

/** Where the key file is served. Must match the route in app/indexnow.txt. */
export const KEY_PATH = "/indexnow.txt";

/**
 * How long we will wait on the endpoint before giving up.
 *
 * Bounded because this runs inside the admin save request. Three seconds is
 * generous for a POST that returns an empty 200, and the cost of exceeding it
 * is only that this particular ping is lost — the sitemap still carries the
 * change.
 */
const TIMEOUT_MS = 3000;

/**
 * The key, when one is configured and well-formed.
 *
 * The protocol requires 8–128 characters from `[a-zA-Z0-9-]`. Validating here
 * rather than at the endpoint means a typo in the environment shows up as
 * "not configured" — no pings, key file 404s — rather than as submissions
 * silently rejected with a 403 nobody reads.
 */
export function indexNowKey(): string | null {
  const raw = process.env.INDEXNOW_KEY?.trim() ?? "";
  return /^[A-Za-z0-9-]{8,128}$/.test(raw) ? raw : null;
}

export type IndexNowResult =
  | { ok: true; submitted: string[]; status: number }
  | { ok: false; reason: string };

/**
 * Site-relative paths → the absolute URLs IndexNow accepts, de-duplicated.
 *
 * Every URL in a submission must be on the host that owns the key; the API
 * rejects the whole batch otherwise. Building them through `abs()` makes that
 * true by construction rather than by care.
 */
export function submissionUrls(paths: string[]): string[] {
  const host = siteHost();
  const seen = new Set<string>();
  for (const p of paths) {
    let url: string;
    try {
      url = abs(p);
    } catch {
      continue;
    }
    if (new URL(url).host !== host) continue;
    seen.add(url);
  }
  return [...seen];
}

/** The exact JSON body the endpoint expects. Separated out so a test can read it. */
export function submissionBody(key: string, urlList: string[]) {
  return {
    host: siteHost(),
    key,
    keyLocation: abs(KEY_PATH),
    urlList,
  };
}

/**
 * Submit changed paths. Never throws.
 *
 * Deliberately awaited by its caller rather than fired and forgotten: on
 * Workers, a promise left running past the response is cancelled, so
 * "fire and forget" would mean "usually does not happen" — the worst kind of
 * integration, one that looks wired up and is not. The bounded timeout is
 * what keeps awaiting it honest.
 */
export async function pingIndexNow(paths: string[]): Promise<IndexNowResult> {
  const key = indexNowKey();
  if (!key) return { ok: false, reason: "INDEXNOW_KEY is not set" };

  const urlList = submissionUrls(paths);
  if (urlList.length === 0) return { ok: false, reason: "no submittable URLs" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(submissionBody(key, urlList)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // 403 means the key file did not verify; 422 means a URL was not on the
      // host. Both are configuration problems worth seeing in the logs, and
      // neither is worth failing a publish over.
      console.warn(`[indexnow] ${SITE.url} submission rejected with ${res.status}`);
      return { ok: false, reason: `endpoint returned ${res.status}` };
    }
    return { ok: true, submitted: urlList, status: res.status };
  } catch (e) {
    console.warn(`[indexnow] submission failed: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, reason: "request failed" };
  }
}
