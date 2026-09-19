import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request CSP with a nonce.
 *
 * Our readers sit behind corporate security teams that actively scan the
 * sites their staff visit — a strict CSP is a trust signal here, not just
 * hygiene. We can afford an unusually tight policy because the platform
 * loads zero third-party resources at runtime.
 *
 * script-src uses a nonce + 'strict-dynamic' so Next's own chunk loading
 * works without opening the door to injected inline script.
 * style-src keeps 'unsafe-inline' because the design system sets CSS custom
 * properties through React style attributes; style injection is a far lower
 * risk than script injection, and this is the standard trade-off.
 */
export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  // Next reads the nonce off the request header and stamps its own scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation output.
    {
      source: "/((?!_next/static|_next/image|fonts/|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
