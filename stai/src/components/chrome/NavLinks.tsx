"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The desktop header links. A client component only because it needs the
 * current path: the section you are in carries aria-current="page", which is
 * what both assistive technology and the underline in globals.css key off.
 */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname() ?? "";
  return (
    <>
      {items.map((n) => {
        const current = isCurrent(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={current ? "page" : undefined}
            className="f-mono px-3 py-2 text-[0.72rem] font-medium tracking-[0.14em] uppercase text-cream-400 transition-colors hover:text-cream-100"
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
