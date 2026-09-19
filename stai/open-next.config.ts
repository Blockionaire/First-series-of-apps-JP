import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare adapter configuration.
 *
 * Deliberately minimal. The defaults build the Next server into a Worker and
 * serve .next/static and public/ through the ASSETS binding, which is exactly
 * what STAI needs. No incremental cache, no tag cache, no queue is configured:
 * every page that touches data is already `force-dynamic`, so there is no ISR
 * to persist and adding a KV cache would be configuration without a purpose.
 *
 * If ISR is introduced later, this is where an R2 or KV incremental cache
 * would be wired in.
 */
export default defineCloudflareConfig();
