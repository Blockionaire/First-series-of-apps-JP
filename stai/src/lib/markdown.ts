import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Markdown is authored by admins, but "admin-authored" is not the same as
 * "safe": a compromised editor account would otherwise become stored XSS on
 * every reader. Sanitising at render turns that incident into a non-event.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "blockquote", "strong", "em",
    "code", "pre", "hr", "br", "table", "thead", "tbody", "tr", "th", "td", "sup", "sub",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  // No javascript:/data: URLs.
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    // External links never get to reach back into our window.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href) && !href.includes("stai.ai");
      return {
        tagName,
        attribs: external ? { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" } : attribs,
      };
    },
  },
};

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

/** Render trusted (editor-authored) markdown to HTML with anchored h2s. */
export function renderMarkdown(md: string): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, "");
        const id = slugifyHeading(plain);
        if (depth === 2) toc.push({ id, text: plain });
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      },
    },
  });
  const html = sanitizeHtml(marked.parse(md) as string, SANITIZE_OPTIONS);
  return { html, toc };
}

/** First N markdown blocks — used for the server-side premium preview cut. */
export function markdownPreview(md: string, blocks = 3): string {
  return md.split(/\n\n+/).slice(0, blocks).join("\n\n");
}
