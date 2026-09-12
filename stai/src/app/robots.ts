import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces and anything that would waste crawl budget.
        disallow: ["/api/", "/admin", "/admin/", "/account", "/checkout/", "/login", "/signup"],
      },
    ],
    sitemap: abs("/sitemap.xml"),
    host: abs("/"),
  };
}
