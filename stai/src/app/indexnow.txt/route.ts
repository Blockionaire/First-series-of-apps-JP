import { indexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

/**
 * The IndexNow ownership proof.
 *
 * The protocol verifies a submission by fetching the `keyLocation` named in
 * it and checking that the body is the key. That is the entire contract: one
 * line, no trailing structure. Serving it from a route rather than from
 * `public/` is what lets the key come from the environment — a committed file
 * would pin one key into Git for every deployment at once, including previews
 * that have no business submitting URLs for production.
 *
 * With no key configured this answers 404, which is the honest response:
 * there is no key, so there is nothing to prove. Submissions are not being
 * made either, so nothing depends on it.
 */
export async function GET() {
  const key = indexNowKey();
  if (!key) return new Response("Not found", { status: 404 });

  return new Response(key, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Short, not immutable: rotating the key must take effect in minutes,
      // because a stale cached body fails every submission until it expires.
      "cache-control": "public, max-age=300",
    },
  });
}
