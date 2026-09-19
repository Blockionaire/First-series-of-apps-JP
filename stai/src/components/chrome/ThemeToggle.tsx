"use client";

import { useEffect, useState } from "react";
import { HEADER_ICON_BTN } from "./icon-button";

/**
 * Dark/light switch: the glyph alone, no frame and no label.
 *
 * The server renders the correct theme from the `stai_theme` cookie (no
 * flash); this just flips the attribute and persists the choice.
 *
 * `theme` is null until mount, because the choice lives on `documentElement`
 * and cannot be read while rendering on the server. The icon is held back
 * until then rather than guessed — a sun that silently becomes a moon a frame
 * later is worse than a beat of nothing, and the button keeps its size
 * either way so the row does not shift.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.cookie = `stai_theme=${next};path=/;max-age=31536000;samesite=lax`;
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
