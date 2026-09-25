/**
 * The reader's theme choice, shared by the server (layout) and the header
 * toggle. Deliberately free of any runtime import so both sides can use it.
 *
 * The `stai_theme` cookie is the whole mechanism. When it is set, the server
 * renders it as `data-theme`, so the first paint is already right — no flash.
 * When it is not set, no `data-theme` is rendered and the default applies:
 * the Paper Edition. `data-theme="dark"` is the Night Edition.
 */

export type Theme = "light" | "dark";

export const THEME_COOKIE = "stai_theme";

/** The explicit choice in the cookie, or undefined when the reader has made none. */
export function themeFromCookie(value: string | undefined): Theme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

/**
 * What the page is showing now, read from the computed `color-scheme` of the
 * root element — every theme block declares one, so this is true on every
 * page without the toggle knowing which page it is on.
 */
export function effectiveTheme(colorScheme: string): Theme {
  return colorScheme.trim().startsWith("light") ? "light" : "dark";
}

export function nextTheme(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}

export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme};path=/;max-age=31536000;samesite=lax`;
}
