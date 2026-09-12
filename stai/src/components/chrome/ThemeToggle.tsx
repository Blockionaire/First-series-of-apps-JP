"use client";

import { useEffect, useState } from "react";

/**
 * Dark/light switch in the system bar. The server renders the correct theme
 * from the `stai_theme` cookie (no flash); this just flips the attribute and
 * persists the choice.
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
      className="f-mono inline-flex items-center gap-1.5 border px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.14em] uppercase rule text-cream-400 transition-colors hover:border-[var(--line-strong)] hover:text-cream-100"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
        {theme === "light" ? (
          /* moon */
          <path d="M8.4 6.1A3.9 3.9 0 0 1 3.9 1.6a4 4 0 1 0 4.5 4.5Z" fill="currentColor" />
        ) : (
          /* sun */
          <>
            <circle cx="5" cy="5" r="2.1" fill="currentColor" />
            <path d="M5 0v1.6M5 8.4V10M0 5h1.6M8.4 5H10M1.5 1.5l1.1 1.1M7.4 7.4l1.1 1.1M8.5 1.5 7.4 2.6M2.6 7.4 1.5 8.5" stroke="currentColor" strokeWidth="0.9" />
          </>
        )}
      </svg>
      <span className="hidden sm:inline">{theme === null ? "…" : theme === "light" ? "Dark" : "Light"}</span>
    </button>
  );
}
