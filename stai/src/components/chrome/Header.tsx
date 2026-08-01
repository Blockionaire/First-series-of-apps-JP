import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { SMark, PlusBadge } from "@/components/Logo";
import EnforcementClock from "./EnforcementClock";
import ThemeToggle from "./ThemeToggle";
import MobileNav from "./MobileNav";

export const NAV = [
  { href: "/briefing", label: "Briefing" },
  { href: "/prompts", label: "Prompts" },
  { href: "/ask", label: "Ask STAI" },
  { href: "/podcast", label: "Podcast" },
  { href: "/research", label: "Research" },
  { href: "/training", label: "Training" },
  // The B2B front door. Assessment moved out of the nav — it converts best as
  // a call to action inside pages, not as a browsing destination.
  { href: "/firms", label: "For firms" },
];

export default async function Header() {
  const user = await currentUser();

  return (
    <header className="sticky top-0 z-50 border-b bg-navy-900/95 backdrop-blur-sm rule-strong">
      {/* System bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 border-b px-4 py-1.5 rule sm:px-6">
        <span className="f-mono hidden text-[0.625rem] tracking-[0.18em] uppercase sm:block" style={{ color: "var(--ink-faint)" }}>
          Signal &amp; training for audit intelligence — Europe
        </span>
        <span className="f-mono inline-flex items-center gap-2 text-[0.625rem] tracking-[0.14em] uppercase" style={{ color: "var(--ink-muted)" }}>
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-signal-up)" }} aria-hidden />
          Live
        </span>
        <span className="flex items-center gap-3">
          <ThemeToggle />
          <EnforcementClock />
        </span>
      </div>

      {/* Main nav */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="STAI home">
          <SMark size={30} />
          <span className="f-display text-2xl leading-none tracking-[0.04em] text-cream-100">STAI</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="f-mono px-3 py-2 text-[0.72rem] font-medium tracking-[0.14em] uppercase text-cream-400 transition-colors hover:text-cream-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <Link
                href="/account"
                className="f-mono inline-flex items-center gap-2 px-2 py-2 text-[0.72rem] tracking-[0.1em] uppercase text-cream-400 hover:text-cream-100"
              >
                {user.name.split(" ")[0] || "Account"}
                {user.plan === "plus" && <PlusBadge />}
              </Link>
              {user.plan !== "plus" && (
                <Link href="/plus" className="btn btn-plus premium-focus text-[0.68rem]">
                  Upgrade to STAI+
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className="f-mono px-2 py-2 text-[0.72rem] tracking-[0.14em] uppercase text-cream-400 hover:text-cream-100">
                Sign in
              </Link>
              <Link href="/plus" className="btn btn-plus premium-focus text-[0.68rem]">
                STAI+
              </Link>
            </>
          )}
        </div>

        <MobileNav
          nav={NAV}
          user={user ? { name: user.name, plus: user.plan === "plus" } : null}
        />
      </div>
    </header>
  );
}
