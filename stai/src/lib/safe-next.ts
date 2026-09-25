/**
 * Where to send someone after they sign in or sign up.
 *
 * The destination arrives in `?next=`, which anyone can write into a link. It
 * used to be passed to `router.push` as given, so
 * `/signup?next=https://attacker.example/` landed a freshly signed-in reader
 * on someone else's site — the classic post-login phishing hop
 * (CODE_AUDIT.md, M1).
 *
 * The rule is "same origin, and a path": the value is resolved against a
 * placeholder origin, exactly as the browser will resolve it, and anything
 * that ends up anywhere else is replaced with the default. Resolving rather
 * than pattern-matching is the point — `//host`, `/\host`, `/<TAB>/host` and
 * `https:host` all look like paths to a regex and all leave the site in a
 * browser; the URL parser is the only thing that sees them the way the
 * browser does.
 *
 * Pure and dependency-free: it runs in the client bundle.
 */
const PLACEHOLDER = "https://next.invalid";

export function safeNext(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER) return fallback;
  return url.pathname + url.search + url.hash;
}
