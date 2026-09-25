import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The Briefing index became News.
 *
 * A permanent redirect rather than a deletion: this URL is in the sitemap
 * that has already been served, in the RSS feed, and in anything anyone
 * bookmarked. 308 tells a crawler to move its index across rather than record
 * a dead page.
 *
 * Only the index moved. Articles still live at /briefing/[slug] and the
 * category pages under /briefing/category/[category], because those addresses
 * are shared by both sections — an article's URL does not say which section
 * it is filed under, so re-filing one never breaks a link to it.
 */
export default function BriefingIndexRedirect() {
  permanentRedirect("/news");
}
