import { notFound } from "next/navigation";
import { isEnabled } from "./site-config";

/**
 * Refuses a page whose switch is off.
 *
 * Hiding the link is not switching a page off. Anyone with the URL — a
 * bookmark, a search result, someone reading the sitemap from last week —
 * still walks straight in, which is the failure mode this exists to prevent.
 *
 * It answers 404 rather than 403 or a "coming soon" panel. A disabled page is
 * not a page you lack permission for, and it is not a promise; from outside,
 * it does not exist. 404 is also the only answer that tells a crawler to drop
 * the URL rather than keep it and come back.
 *
 * Call it first in the page body, before any query: a switched-off page should
 * not touch the database at all.
 */
export async function requirePage(id: string): Promise<void> {
  if (!(await isEnabled(id))) notFound();
}
