"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  nav: { href: string; label: string }[];
  user: { name: string; plus: boolean } | null;
};

export default function MobileNav({ nav, user }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="f-mono inline-flex items-center gap-2 border px-3 py-2 text-[0.7rem] tracking-[0.14em] uppercase rule-strong text-cream-200"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Menu"}
      </button>

      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          className="fixed inset-x-0 top-[6.6rem] bottom-0 z-50 overflow-y-auto border-t bg-navy-900 rule-strong"
        >
          <nav className="flex flex-col px-6 py-6" aria-label="Primary mobile">
            {nav.map((n, i) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-baseline gap-4 border-b py-4 rule"
              >
                <span className="index-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="f-display text-2xl text-cream-100">{n.label}</span>
              </Link>
            ))}
            <div className="mt-6 flex flex-col gap-3">
              {user ? (
                <Link href="/account" onClick={() => setOpen(false)} className="btn btn-ghost">
                  Account — {user.name.split(" ")[0]}
                </Link>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-ghost">
                  Sign in
                </Link>
              )}
              {(!user || !user.plus) && (
                <Link href="/plus" onClick={() => setOpen(false)} className="btn btn-plus premium-focus">
                  STAI+ membership
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
