import Link from "next/link";
import { SMark } from "@/components/Logo";
import NewsletterForm from "@/components/NewsletterForm";
import { enabledMap, toggleForPath } from "@/lib/site-config";

const COLS: { head: string; links: { href: string; label: string }[] }[] = [
  {
    head: "Intelligence",
    links: [
      { href: "/news", label: "News" },
      { href: "/insights", label: "Insights" },
      { href: "/podcast", label: "Podcast" },
      { href: "/research", label: "Research desk" },
      { href: "/ask", label: "Ask STAI" },
    ],
  },
  {
    head: "Practice",
    links: [
      { href: "/prompts", label: "Prompt library" },
      { href: "/firms", label: "STAI for firms" },
      { href: "/training", label: "Training programmes" },
      { href: "/assessment", label: "AI-readiness assessment" },
      { href: "/ai-act", label: "EU AI Act tracker" },
      { href: "/plus", label: "STAI+ membership" },
    ],
  },
  {
    head: "Company",
    links: [
      { href: "/about", label: "About STAI" },
      { href: "/contact", label: "Contact" },
      { href: "/legal/company", label: "Company information" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
    ],
  },
];

export default async function Footer() {
  // The footer is the other place a switched-off page leaks out. The header
  // was filtered from the start; this column list was not, so /ask stayed
  // linked here while the route already answered 404. One map, both menus.
  const enabled = await enabledMap();
  const live = (href: string) => {
    const t = toggleForPath(href);
    return !t || enabled[t.id];
  };
  const cols = COLS.map((c) => ({ ...c, links: c.links.filter((l) => live(l.href)) })).filter(
    (c) => c.links.length > 0
  );

  return (
    <footer className="border-t bg-navy-950 rule-strong">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          {/* Brief signup */}
          <div>
            <div className="flex items-center gap-3">
              <SMark size={26} />
              <span className="f-display text-xl text-cream-100">The STAI Brief</span>
            </div>
            <p className="mt-3 max-w-md text-sm" style={{ color: "var(--ink-muted)" }}>
              A weekly dispatch on the regulatory moves and standards signals that matter to European audit
              and finance. It hasn&apos;t started yet — join the waitlist and we&apos;ll write to you once,
              when the first issue is ready. No mail until then.
            </p>
            {enabled.newsletter && (
              <div className="mt-4 max-w-md">
                <NewsletterForm source="footer" />
              </div>
            )}
          </div>

          {/* Sitemap */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {cols.map((col) => (
              <div key={col.head}>
                <h3 className="f-label" style={{ color: "var(--ink-faint)" }}>
                  {col.head}
                </h3>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm text-cream-400 transition-colors hover:text-cream-100">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t pt-6 rule sm:flex-row sm:items-center sm:justify-between">
          <p className="f-mono text-[0.65rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
            © {new Date().getFullYear()} STAI — stai-ahead.com · Amsterdam
          </p>
          <p className="f-mono text-[0.65rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
            No trackers, no third-party scripts, no advertising
          </p>
        </div>
      </div>
    </footer>
  );
}
