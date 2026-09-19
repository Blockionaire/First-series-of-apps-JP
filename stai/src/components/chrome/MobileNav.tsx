"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SMark, Wordmark } from "@/components/Logo";

type Props = {
  nav: { href: string; label: string }[];
  user: { name: string; plus: boolean } | null;
};

/**
 * The mobile menu.
 *
 * ── Why the panel is rendered through a portal ───────────────────────────
 * It used to be an ordinary child of this component, `position: fixed` with
 * `top-[6.6rem] bottom-0` to sit under the header. That silently stopped
 * working: the header carries `backdrop-blur`, and an ancestor with a
 * `backdrop-filter` (or `filter`, `transform`, `perspective`, `contain`)
 * becomes the containing block for its fixed-position descendants. So `top`
 * and `bottom` resolved against the ~92px header instead of the viewport,
 * and the panel computed to a 1px-tall sliver. It opened; there was just
 * nothing to see.
 *
 * A portal to `document.body` puts the panel outside that containing block,
 * so `fixed` means the viewport again. The panel is now a full-screen
 * overlay carrying its own logo row, which also removes the hardcoded offset
 * — there is no header height left to guess at, so this cannot drift again
 * the next time the header changes.
 *
 * No `mounted` guard is needed before touching `document`: `open` is false
 * during SSR and during hydration, and can only turn true from a click in
 * the browser.
 */
export default function MobileNav({ nav, user }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);

    // Lock the document, not just the body. Locking `body` alone leaves the
    // page horizontally scrollable wherever content overruns the viewport —
    // and a document that scrolls sideways can widen the block a fixed,
    // full-bleed panel is sized against, pushing Close off the screen edge.
    // Locking both keeps the overlay exactly one viewport wide whatever the
    // page underneath is doing.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    // The panel lives in a portal, so the wrapper's `lg:hidden` no longer
    // covers it. Without this, growing the viewport past `lg` would hide the
    // panel by CSS while `open` stayed true — leaving the body scroll-locked
    // on a desktop layout with no way to release it.
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setOpen(false);
    onWide();
    wide.addEventListener("change", onWide);

    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="f-mono inline-flex items-center border px-3 py-2 text-[0.7rem] tracking-[0.14em] uppercase rule-strong text-cream-200"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        Menu
      </button>

      {open &&
        createPortal(
          <div
            id="mobile-menu"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[60] flex flex-col bg-navy-900 outline-none lg:hidden"
          >
            <div className="flex items-center justify-between gap-4 border-b px-4 py-3 rule-strong sm:px-6">
              <Link href="/" onClick={close} className="flex items-center gap-3" aria-label="STAI home">
                <SMark size={30} />
                <Wordmark height={22} className="text-cream-100" />
              </Link>
              <button
                type="button"
                onClick={close}
                className="f-mono inline-flex items-center border px-3 py-2 text-[0.7rem] tracking-[0.14em] uppercase rule-strong text-cream-200"
              >
                Close
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-6 py-6" aria-label="Primary mobile">
              {nav.map((n, i) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={close}
                  className="flex items-baseline gap-4 border-b py-4 rule"
                >
                  <span className="index-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="f-display text-2xl text-cream-100">{n.label}</span>
                </Link>
              ))}
              <div className="mt-6 flex flex-col gap-3">
                {user ? (
                  <Link href="/account" onClick={close} className="btn btn-ghost">
                    Account — {user.name.split(" ")[0]}
                  </Link>
                ) : (
                  <Link href="/login" onClick={close} className="btn btn-ghost">
                    Sign in
                  </Link>
                )}
                {(!user || !user.plus) && (
                  <Link href="/plus" onClick={close} className="btn btn-plus premium-focus">
                    STAI+ membership
                  </Link>
                )}
              </div>
            </nav>
          </div>,
          document.body
        )}
    </div>
  );
}
