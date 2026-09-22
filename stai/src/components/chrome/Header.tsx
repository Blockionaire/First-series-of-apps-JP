import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { SMark, Wordmark, PlusBadge } from "@/components/Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import MobileNav from "./MobileNav";
import { HEADER_ICON_BTN } from "./icon-button";
import { enabledMap } from "@/lib/site-config";

/**
 * The navigation, and the switch that governs each entry.
 *
 * `toggle` is the id in lib/site-config.ts. The entry disappears from every
 * menu when that switch is off, and the page itself answers 404 — the link and
 * the route are governed by one value, so they cannot disagree.
 *
 * Assessment and Research are deliberately absent: they convert as a call to
 * action inside a page, not as a browsing destination. Both remain reachable
 * and both have their own switch.
 */
export const NAV = [
  { href: "/news", label: "News", toggle: "news" },
  { href: "/insights", label: "Insights", toggle: "insights" },
  { href: "/prompts", label: "Prompts", toggle: "prompts" },
  { href: "/podcast", label: "Podcast", toggle: "podcast" },
  { href: "/ai-act", label: "AI Act", toggle: "aiAct" },
  { href: "/ask", label: "Ask STAI", toggle: "ask" },
  { href: "/training", label: "Training", toggle: "training" },
  { href: "/firms", label: "For firms", toggle: "firms" },
];

function PersonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <circle cx="8" cy="5.4" r="2.9" />
      <path d="M2.6 14.2a5.4 5.4 0 0 1 10.8 0" strokeLinecap="round" />
    </svg>
  );
}

export default async function Header() {
  const user = await currentUser();
  const enabled = await enabledMap();
  const nav = NAV.filter((n) => enabled[n.toggle]);
  const plusOn = enabled.plus;

  return (
    <header className="sticky top-0 z-50 border-b bg-navy-900/95 backdrop-blur-sm rule-strong">
      {/* One row. The old system bar above this one carried a tagline, a LIVE
          dot and the enforcement clock — three competing signals in 27px of
          height, which read as clutter on a phone and pushed the actual
          navigation down the screen. The clock still runs on /, /ai-act,
          /firms and /assessment, where it has room to mean something. */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* The S is drawn on a wider box than the wordmark, so matching their
            nominal heights made it read as the larger of the two. Set a touch
            below the wordmark's cap height instead, which is where the pair
            actually looks level. */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="STAI home">
          <SMark size={23} />
          <Wordmark height={22} className="text-cream-100" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {nav.map((n) => (
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
        <div className="flex items-center gap-1 lg:gap-1.5">
          <ThemeToggle />
          <LanguageToggle />

          <div className="hidden items-center gap-1.5 lg:flex">
            {user ? (
              <>
                {/* The name used to be spelled out here, which put whatever
                    the account was called — "The" in one real case — in the
                    middle of the chrome as if it were a nav item. The icon
                    says "your account" without competing for attention; the
                    name still reaches assistive tech through the label. */}
                {/* One click to the back office for the account that has
                    one. It sits before the person icon rather than replacing
                    it: the icon still means "you", and an admin needs both. */}
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    className="f-mono px-2 py-2 text-[0.72rem] tracking-[0.14em] uppercase text-cream-400 hover:text-cream-100"
                  >
                    Desk
                  </Link>
                )}
                <Link
                  href="/account"
                  className={HEADER_ICON_BTN}
                  aria-label={`Account — ${user.name}`}
                  title={user.name}
                >
                  <PersonIcon />
                </Link>
                {user.plan === "plus" && <PlusBadge />}
                {user.plan !== "plus" && plusOn && (
                  <Link href="/plus" className="btn btn-plus btn-sm premium-focus ml-1.5">
                    Upgrade to STAI+
                  </Link>
                )}
              </>
            ) : (
              <>
                {/* Signed out this stays a word, not a glyph: it is the one
                    control here asking the reader to do something, and an
                    unlabelled icon would bury it among the settings. */}
                <Link href="/login" className="f-mono px-2 py-2 text-[0.72rem] tracking-[0.14em] uppercase text-cream-400 hover:text-cream-100">
                  Sign in
                </Link>
                {plusOn && (
                  <Link href="/plus" className="btn btn-plus btn-sm premium-focus">
                    STAI+
                  </Link>
                )}
              </>
            )}
          </div>

          <MobileNav
            nav={nav}
            user={user ? { name: user.name, plus: user.plan === "plus", admin: user.role === "admin" } : null}
            plusOn={plusOn}
          />
        </div>
      </div>
    </header>
  );
}
