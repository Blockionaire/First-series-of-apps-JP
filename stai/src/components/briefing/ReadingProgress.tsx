"use client";

import { useEffect, useRef } from "react";

/** Hairline reading-progress bar pinned under the header. Passive scroll, rAF-throttled. */
export default function ReadingProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        el.style.transform = `scaleX(${p})`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="sticky top-0 z-40 h-[2px] w-full" aria-hidden="true">
      <div
        ref={ref}
        className="h-full w-full origin-left bg-cream-400"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
