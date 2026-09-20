"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isTrackablePath } from "@/lib/analytics-paths";

/**
 * Sends one page-view beacon per navigation. Fire-and-forget: a failed beacon
 * must never surface to the reader. Nothing is read from the browser beyond
 * the path — no referrer, no screen size, no device data.
 *
 * Back-office paths send nothing at all, so opening the desk does not even
 * cost a request. The route enforces the same rule, because this file is
 * cached in browsers and cannot be the guarantee.
 */
export default function Analytics() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    // Recorded before the trackability check, not after: otherwise a visit to
    // /admin in between two views of / would leave `last` pointing at /, and
    // the return to / would be silently dropped as a repeat.
    last.current = pathname;
    if (!isTrackablePath(pathname)) return;
    const payload = JSON.stringify({ kind: "page_view", path: pathname });
    // keepalive so the beacon survives the navigation that triggered it.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
