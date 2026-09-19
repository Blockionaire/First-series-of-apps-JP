"use client";

import { useEffect, useRef, useState } from "react";
import { HEADER_ICON_BTN } from "./icon-button";

/**
 * Language switcher.
 *
 * English is the only language the platform is actually published in today,
 * so that is the only one this offers. Dutch is listed beside it, plainly
 * marked as not ready and not clickable.
 *
 * Showing it rather than hiding it is deliberate: the menu tells a Dutch
 * reader that Dutch is coming, which is useful. What it must not do is
 * pretend — a selectable "Nederlands" that silently served English would be
 * worse than no switcher at all. When the translations land, flip `ready` and
 * wire the codes to whatever routing carries the locale.
 */
type Language = { code: string; label: string; english: string; ready: boolean };

const LANGUAGES: Language[] = [
  { code: "en", label: "English", english: "English", ready: true },
  { code: "nl", label: "Nederlands", english: "Dutch", ready: false },
];

const CURRENT = "en";

export default function LanguageToggle() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Change language — English"
        title="Language"
        className={HEADER_ICON_BTN}
      >
        {/* globe */}
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
          <circle cx="8" cy="8" r="6.3" />
          <path d="M2.1 6.2h11.8M2.1 9.8h11.8" />
          <ellipse cx="8" cy="8" rx="2.9" ry="6.3" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Language"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] border bg-navy-900 py-1 rule-strong"
        >
          {LANGUAGES.map((l) => {
            const current = l.code === CURRENT;
            return (
              <div
                key={l.code}
                role="menuitem"
                aria-current={current || undefined}
                aria-disabled={!l.ready || undefined}
                className={`f-mono flex items-center justify-between gap-3 px-3 py-2 text-[0.68rem] tracking-[0.1em] uppercase ${
                  current ? "text-cream-100" : "text-cream-400"
                }`}
                style={!l.ready ? { color: "var(--ink-faint)" } : undefined}
              >
                <span lang={l.code}>{l.label}</span>
                {current && <span aria-hidden>✓</span>}
                {!l.ready && <span className="text-[0.6rem] tracking-[0.08em]">soon</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
