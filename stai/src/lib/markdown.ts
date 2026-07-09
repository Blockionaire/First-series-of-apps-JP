import { Marked } from "marked";

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
  const html = marked.parse(md) as string;
  return { html, toc };
}

/** First N markdown blocks — used for the server-side premium preview cut. */
export function markdownPreview(md: string, blocks = 3): string {
  return md.split(/\n\n+/).slice(0, blocks).join("\n\n");
}
