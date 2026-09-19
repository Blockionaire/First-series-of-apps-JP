import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { SMark, Wordmark, PlusBadge } from "@/components/Logo";
import ThemeToggle from "./ThemeToggle";
import MobileNav from "./MobileNav";

export const NAV = [
  { href: "/briefing", label: "Briefing" },
  { href: "/prompts", label: "Prompts" },
  { href: "/ai-act", label: "AI Act" },
  { href: "/ask", label: "Ask STAI" },
  { href: "/training", label: "Training" },
  // The B2B front door. Assessment moved out of the nav — it converts best as
  // a call to action inside pages, not as a browsing destination.
  { href: "/firms", label: "For firms" },
];

export default async function Header() {
  const user = await currentUser();

  return (
    <header className="sticky top-0 z-50 border-b bg-navy-900/95 backdrop-blur-sm rule-strong">
      {/* One row. The old system bar above this one carried a tagline, a LIVE
          dot and the enforcement clock — three competing signals in 27px of
          height, which read as clutter on a phone and pushed the actual
          navigation down the screen. The clock still runs on /, /ai-act,
          /firms and /assessment, where it has room to mean something. */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="STAI home">
          <SMark size={30} />
          <Wordmark height={22} className="text-cream-100" />
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

        {/* One right-hand cluster for both breakpoints, so the theme toggle
            exists exactly once. Rendering it twice behind `lg:hidden` would
            give two components with independent state, and the hidden one
            would hold a stale label after the other was used. */}
        <div className="flex items-center gap-2 lg:gap-3">
          <ThemeToggle />

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
      </div>
    </header>
  );
}
