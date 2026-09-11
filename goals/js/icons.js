/* =====================================================================
   GOALS — icons
   =====================================================================
   A small set of line drawings, inline so they take the colour of the
   text around them and cost nothing to load. Sparingly used: the
   navigation, and the few actions that would otherwise need a word.
   ===================================================================== */

const PATHS = {
  home:      '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  goals:     '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.4"/>',
  curiosity: '<circle cx="12" cy="12" r="8.2"/><path d="m15.2 8.8-2 4.4-4.4 2 2-4.4z"/>',
  reviews:   '<rect x="3.5" y="4.5" width="17" height="16" rx="1.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/>',
  settings:  '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="17" r="2"/>',
  search:    '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5"/>',
  plus:      '<path d="M12 5.5v13M5.5 12h13"/>',
  check:     '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow:     '<path d="M4 12h15m-5.5-5.5L19 12l-5.5 5.5"/>',
  back:      '<path d="M20 12H5m5.5-5.5L5 12l5.5 5.5"/>',
  edit:      '<path d="M4 20h4l10-10-4-4L4 16zM14.5 5.5l4 4"/>',
  link:      '<path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
  book:      '<path d="M4 4.5h6a3 3 0 0 1 2 2.8V20a2.4 2.4 0 0 0-2-1.6H4zM20 4.5h-6a3 3 0 0 0-2 2.8V20a2.4 2.4 0 0 1 2-1.6h6z"/>',
};

export function icon(name, { size = 20, className = "" } = {}) {
  const path = PATHS[name];
  if (!path) return "";
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}
