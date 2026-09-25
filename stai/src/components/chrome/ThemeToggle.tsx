"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HEADER_ICON_BTN } from "./icon-button";
import { effectiveTheme, nextTheme, themeCookie, type Theme } from "@/lib/theme-choice";

/**
 * Dark/light switch: the glyph alone, no frame and no label.
 *
 * The server renders the reader's choice from the `stai_theme` cookie (no
 * flash); this flips the attribute and persists the choice. The two themes
 * are the Paper Edition (the default) and the Night Edition.
 *
 * The current theme is read from the root's computed `color-scheme` rather
 * than from `data-theme`, because with no choice made there is no attribute
 * at all, and the button must offer the opposite of what is actually on
 * screen. It is re-read on every navigation, since the header outlives the
 * page beneath it.
 *
 * `theme` is null until mount, because the choice cannot be read while
 * rendering on the server. The icon is held back until then rather than
 * guessed — a sun that silently becomes a moon a frame later is worse than a
 * beat of nothing, and the button keeps its size either way so the row does
 * not shift.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setTheme(effectiveTheme(getComputedStyle(document.documentElement).colorScheme));
  }, [pathname]);

  function toggle() {
    const next = nextTheme(theme ?? effectiveTheme(getComputedStyle(document.documentElement).colorScheme));
    document.documentElement.dataset.theme = next;
    document.cookie = themeCookie(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      title={theme === "light" ? "Dark theme" : "Light theme"}
      className={HEADER_ICON_BTN}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
        {theme === null ? null : theme === "light" ? (
          /* moon — shown on the light theme, because it switches TO dark */
          <path d="M13.4 9.8A6.2 6.2 0 0 1 6.2 2.6a6.4 6.4 0 1 0 7.2 7.2Z" fill="currentColor" />
        ) : (
          /* sun */
          <>
            <circle cx="8" cy="8" r="3.2" fill="currentColor" />
            <path
              d="M8 0.6v2M8 13.4v2M0.6 8h2M13.4 8h2M2.8 2.8l1.4 1.4M11.8 11.8l1.4 1.4M13.2 2.8l-1.4 1.4M4.2 11.8l-1.4 1.4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}
