import type { NextConfig } from "next";
import nodePath from "path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Makes Cloudflare bindings (the D1 database) available during `next dev`, so
 * local development and the Workers runtime read the same database rather than
 * diverging. It is a no-op in a production build.
 */
void initOpenNextCloudflareForDev();

/**
 * Static security headers. The per-request CSP (which needs a nonce) is set
 * in src/middleware.ts; everything here is constant and also covers static
 * assets, which middleware deliberately skips.
 */
const securityHeaders = [
  // Two years, preloadable. Only meaningful once TLS is terminated in front
  // of the app — harmless before that.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // We ask for none of these; say so explicitly.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

/**
 * Which runtime this build targets.
 *
 * Set by `npm run cf:build`. It exists because the two targets need different
 * module resolution and Next resolves modules once, at build time — before
 * OpenNext or esbuild or Wrangler get a say. An export condition or a bundler
 * external cannot undo a require that `next build` has already emitted.
 */
const WORKERS_BUILD = process.env.STAI_BUILD_TARGET === "workers";

const nextConfig: NextConfig = {
  // Minimal runtime bundle for the container: Next traces only the modules the
  // server actually needs. public/ and .next/static/ are NOT included by
  // standalone output and are copied explicitly in the Dockerfile.
  /**
   * Both targets write `.next`, and that cannot be changed here: OpenNext
   * reads `.next` unconditionally and ignores `distDir`. Setting one produced
   * a Worker built from whatever `.next` happened to contain — in one run, the
   * Node build, complete with the native SQLite addon.
   *
   * So the two builds are separated in TIME, not in space: `npm run build` and
   * `npm run cf:build` each wipe `.next` first, and the test suites each
   * follow their own build. `npm run verify` runs the whole sequence in the
   * only order that is valid.
   */
  output: "standalone",
  // Node only: the native binding must resolve at runtime rather than be
  // bundled. On Workers the module that imports it is replaced entirely (see
  // webpack below), so this list never comes into play there.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  /**
   * Next's built-in image optimizer is what pulls in `sharp`, a native module
   * Workers cannot load. STAI ships no raster images through next/image — the
   * design is typographic, the only bitmaps are the generated OG cards, and
   * those are produced by next/og (satori + resvg in WebAssembly), not by the
   * optimizer.
   *
   * So the optimizer is turned off rather than replaced. This is the smallest
   * supported change: `<Image>` still renders, src attributes pass through
   * untouched, and nothing on the site loses a feature it was using.
   */
  images: { unoptimized: true },
  /**
   * Keep the native SQLite addon out of the Worker.
   *
   * Three Node-only modules import better-sqlite3 (the local database, the
   * Node driver, and the frozen payment-mutation module). None is reached on
   * Workers — the driver there is D1 — but Next still emits their requires,
   * which drags a 2.2 MB package and a compiled .node binary into the bundle.
   *
   * Aliasing the package to a module that throws removes both, and turns the
   * theoretical "this is never reached" into something that would fail loudly
   * and by name if it ever were.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any, { webpack }: any) => {
    /**
     * The two targets must not share a build cache.
     *
     * The Workers build replaces src/lib/db.ts with a stub. Webpack's
     * filesystem cache does not key on that replacement, so a Node build run
     * after a Workers build reused the stubbed chunks and shipped a Node
     * server with no database — it compiled cleanly and then failed at
     * runtime. Naming the target in the cache version separates them.
     */
    config.cache = {
      ...(typeof config.cache === "object" ? config.cache : {}),
      version: `stai-${WORKERS_BUILD ? "workers" : "node"}`,
    };

    if (WORKERS_BUILD) {
      // NOT resolve.alias on "better-sqlite3": Next externalises node_modules
      // in the server build, so that require is emitted bare and an alias
      // never fires. src/lib/db.ts is first-party and genuinely bundled, and
      // it is the only module that imports the addon — replacing it is what
      // actually keeps better_sqlite3.node out of the Worker.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]src[\\/]lib[\\/]db\.ts$/,
          nodePath.resolve(import.meta.dirname, "src/lib/db-unavailable.ts")
        )
      );
    }
    return config;
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Fonts are content-hashed by filename and never change in place.
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
