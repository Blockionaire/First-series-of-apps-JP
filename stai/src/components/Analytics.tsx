"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends one page-view beacon per navigation. Fire-and-forget: a failed beacon
 * must never surface to the reader. Nothing is read from the browser beyond
 * the path — no referrer, no screen size, no device data.
 */
export default function Analytics() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
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
