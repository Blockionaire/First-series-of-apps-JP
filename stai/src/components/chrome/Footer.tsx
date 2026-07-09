import Link from "next/link";
import { SMark } from "@/components/Logo";
import NewsletterForm from "@/components/NewsletterForm";

const COLS: { head: string; links: { href: string; label: string }[] }[] = [
  {
    head: "Intelligence",
    links: [
      { href: "/briefing", label: "The Briefing" },
      { href: "/podcast", label: "Podcast" },
      { href: "/research", label: "Research desk" },
      { href: "/ask", label: "Ask STAI" },
    ],
  },
  {
    head: "Practice",
    links: [
      { href: "/prompts", label: "Prompt library" },
      { href: "/training", label: "Training for firms" },
      { href: "/assessment", label: "AI-readiness assessment" },
      { href: "/plus", label: "STAI+ membership" },
    ],
  },
  {
    head: "Company",
    links: [
      { href: "/about", label: "About STAI" },
      { href: "/contact", label: "Contact" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
    ],
  },
];

export default function Footer() {
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
              One dispatch, every Tuesday. The regulatory moves, standards signals and field intelligence that
              matter to European audit and finance — read in four minutes, quoted in your next partner meeting.
            </p>
            <div className="mt-4 max-w-md">
              <NewsletterForm source="footer" />
            </div>
          </div>

          {/* Sitemap */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLS.map((col) => (
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
            © {new Date().getFullYear()} STAI — stai.ai · Amsterdam
          </p>
          <p className="f-mono text-[0.65rem] tracking-[0.12em] uppercase" style={{ color: "var(--ink-faint)" }}>
            Built to run inside your firewall — no external runtime dependencies
          </p>
        </div>
      </div>
    </footer>
  );
}
