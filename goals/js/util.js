/* =====================================================================
   GOALS — helpers
   =====================================================================
   Formatting, dates, weeks, the sheet that slides up from the bottom,
   and the small inline charts. Nothing in here knows what a goal is.
   ===================================================================== */

/* ---------------------------------------------------------------
   DOM
   --------------------------------------------------------------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* Everything the user typed goes through here before it becomes HTML.
   The views build strings, so this is the only thing between a note
   and an injected <script>. */
export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Plain text with line breaks kept, for notes and reflections. */
export const escLines = value => esc(value).replace(/\n/g, "<br>");

export function on(root, selector, event, handler) {
  root.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

/* ---------------------------------------------------------------
   Identity and time
   --------------------------------------------------------------- */
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export const now = () => Date.now();

export function todayISO() {
  return toISO(new Date());
}

export function toISO(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* Parse a yyyy-mm-dd as a local date, not as UTC midnight — otherwise
   everybody west of Greenwich logs yesterday's workout. */
export function fromISO(iso) {
  if (!iso) return new Date(NaN);
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const monthOf = iso => String(iso || "").slice(0, 7);
export const monthNow = () => monthOf(todayISO());

export function addDays(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function daysBetween(fromIso, toIso) {
  const a = fromISO(fromIso), b = fromISO(toIso);
  return Math.round((b - a) / 86400000);
}

/* The week runs Monday to Sunday. Returns the Monday as yyyy-mm-dd. */
export function weekStart(iso = todayISO()) {
  const d = fromISO(iso);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toISO(d);
}

export const weekEnd = iso => addDays(weekStart(iso), 6);

export function monthStart(month) {
  return `${month}-01`;
}

export function monthEnd(month) {
  const [y, m] = month.split("-").map(Number);
  return toISO(new Date(y, m, 0));
}

export function inRange(iso, from, to) {
  if (!iso) return false;
  const d = String(iso).slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

/* ---------------------------------------------------------------
   Formatting
   --------------------------------------------------------------- */
const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const monthName = month => {
  const [y, m] = String(month).split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
};

export const monthNameShort = month => {
  const [y, m] = String(month).split("-").map(Number);
  return `${MONTHS_SHORT[(m || 1) - 1]} ${String(y).slice(2)}`;
};

export function formatDate(iso, style = "medium") {
  const d = fromISO(iso);
  if (isNaN(d)) return "";
  if (style === "short")  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (style === "day")    return `${DAYS_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (style === "long")   return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatRange(fromIso, toIso) {
  const a = fromISO(fromIso), b = fromISO(toIso);
  if (isNaN(a) || isNaN(b)) return "";
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = `${MONTHS_SHORT[a.getMonth()]}${sameYear ? "" : " " + a.getFullYear()}`;
  return `${left} – ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
}

/* 7 – 13 September 2026, without saying September twice. */
export function formatSpan(fromIso, toIso) {
  const a = fromISO(fromIso), b = fromISO(toIso);
  if (isNaN(a) || isNaN(b)) return "";
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}${sameYear ? "" : " " + a.getFullYear()} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
}

/* Relative day, for the activity feed. */
export function relativeDay(iso) {
  const diff = daysBetween(iso, todayISO());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return formatDate(iso, "short");
}

/* A number as typed on a phone. An iPhone set to Dutch puts a comma on
   the decimal key, and <input type="number"> silently throws away a
   value it cannot parse — which is why a 4,5 km run used to arrive as
   nothing at all. So: text inputs with a decimal keypad, parsed here. */
export function parseNumber(text) {
  if (text === null || text === undefined) return null;
  const cleaned = String(text).trim().replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-") return null;
  const value = Number(cleaned);
  return isNaN(value) ? null : value;
}

/* 24.566 minutes → "24:34". Used for anything timed to the second. */
export function formatClock(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return "–";
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/* 5.46 minutes per kilometre → "5:28 /km". */
export function formatPace(minutesPerKm) {
  if (!minutesPerKm || isNaN(minutesPerKm) || !isFinite(minutesPerKm)) return "–";
  return `${formatClock(minutesPerKm)} /km`;
}

/* Minutes as a decimal, from a minutes field and a seconds field. */
export function minutesFrom(minutes, seconds) {
  if (minutes === null && seconds === null) return null;
  return (minutes || 0) + (seconds || 0) / 60;
}

/* And back again, for the edit form. */
export function splitMinutes(value) {
  if (value === null || value === undefined || isNaN(value)) return { minutes: null, seconds: null };
  const total = Math.round(value * 60);
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) return "–";
  return Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* Money without decimals unless the cents actually say something. */
export function formatMoney(value, { decimals = null } = {}) {
  if (value === null || value === undefined || isNaN(value)) return "–";
  const n = Number(value);
  const d = decimals !== null ? decimals : (Math.round(n) === n ? 0 : 2);
  return "€" + formatNumber(n, d);
}

export function formatDuration(minutes) {
  if (!minutes) return "–";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

/* One place that knows how a metric value should read. */
export function formatValue(value, unit, { decimals = null } = {}) {
  if (value === null || value === undefined || isNaN(value)) return "–";
  switch (unit) {
    case "eur":      return formatMoney(value, { decimals });
    case "kg":       return `${formatNumber(value, decimals === null ? 1 : decimals)} kg`;
    case "km":       return `${formatNumber(value, decimals === null ? 1 : decimals)} km`;
    case "hours":    return `${formatNumber(value, Number.isInteger(Number(value)) ? 0 : 1)}h`;
    case "minutes":  return formatDuration(value);
    case "sessions": return formatNumber(value);
    case "count":    return formatNumber(value);
    case "percent":  return `${formatNumber(value, decimals === null ? 0 : decimals)}%`;
    case "pace":     return formatPace(value);
    default:         return formatNumber(value, decimals === null ? 0 : decimals);
  }
}

export const pluralise = (n, one, many) => `${n} ${n === 1 ? one : (many || one + "s")}`;

/* Accent-insensitive, case-insensitive — for search. */
export function normalise(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------------------------------------------------------------
   Feedback
   --------------------------------------------------------------- */
let toastTimer = null;

export function toast(message, kind = "") {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast toast--visible ${kind ? "toast--" + kind : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast"; }, 2600);
}

/* ---------------------------------------------------------------
   The sheet
   ---------------------------------------------------------------
   One dialog used for every form in the app: it slides up from the
   bottom on a phone and sits in the middle on a desktop. `build` gets
   the body element and returns an optional cleanup function.
   --------------------------------------------------------------- */
export function sheet({ title, subtitle = "", body, footer = "", wide = false, onMount }) {
  const previous = document.activeElement;
  const dialog = document.createElement("div");
  dialog.className = "sheet-backdrop";
  dialog.innerHTML = `
    <div class="sheet ${wide ? "sheet--wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="sheet__head">
        <div>
          <h2 class="sheet__title">${esc(title)}</h2>
          ${subtitle ? `<p class="sheet__subtitle">${esc(subtitle)}</p>` : ""}
        </div>
        <button class="icon-button" data-close aria-label="Close">✕</button>
      </header>
      <div class="sheet__body">${typeof body === "string" ? body : ""}</div>
      ${footer ? `<footer class="sheet__foot">${footer}</footer>` : ""}
    </div>`;

  document.body.appendChild(dialog);
  document.body.classList.add("is-locked");

  const bodyEl = $(".sheet__body", dialog);
  if (typeof body === "function") body(bodyEl);

  let cleanup = null;
  const close = (result) => {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } }
    dialog.remove();
    document.body.classList.remove("is-locked");
    document.removeEventListener("keydown", onKey);
    if (previous && previous.focus) previous.focus();
    if (dialog._resolve) dialog._resolve(result);
  };

  const onKey = e => {
    if (e.key === "Escape") { e.preventDefault(); close(null); }
    if (e.key === "Tab") trapFocus(e, dialog);
  };

  document.addEventListener("keydown", onKey);
  dialog.addEventListener("click", e => {
    if (e.target === dialog || e.target.closest("[data-close]")) close(null);
  });

  if (onMount) cleanup = onMount(dialog, close) || null;

  /* Focus the first field so a phone keyboard opens right away. */
  const first = $("input, textarea, select, button:not([data-close])", dialog);
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);

  return {
    element: dialog,
    close,
    done: new Promise(resolve => { dialog._resolve = resolve; }),
  };
}

function trapFocus(e, root) {
  const focusable = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', root);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function confirmSheet({ title, message, confirmLabel = "Delete", danger = true }) {
  const s = sheet({
    title,
    body: `<p class="prose">${escLines(message)}</p>`,
    footer: `
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button ${danger ? "button--danger" : "button--solid"}" data-confirm>${esc(confirmLabel)}</button>`,
    onMount: (dialog, close) => {
      $("[data-confirm]", dialog).addEventListener("click", () => close(true));
    },
  });
  return s.done;
}

/* ---------------------------------------------------------------
   Small charts
   ---------------------------------------------------------------
   Inline SVG, no library. Thin lines, no fills, no gridlines — the
   numbers do the talking and the chart only shows the shape.
   --------------------------------------------------------------- */
export function sparkline(values, { width = 240, height = 44, target = null } = {}) {
  const points = values.filter(v => typeof v === "number" && !isNaN(v));
  if (points.length < 2) return "";

  /* Only draw the target when it is near enough to share a scale. A
     target of 44 next to a line that runs from 1 to 5 would flatten the
     line into nothing, which is the opposite of the point. */
  const low = Math.min(...points), high = Math.max(...points);
  const reach = (high - low || Math.abs(high) || 1) * 1.5;
  const showTarget = target !== null && target >= low - reach && target <= high + reach;

  const all = showTarget ? points.concat([target]) : points;
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const pad = 4;
  const x = i => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const y = v => height - pad - ((v - min) / span) * (height - pad * 2);

  const path = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const targetLine = !showTarget ? "" :
    `<line x1="0" x2="${width}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"
           class="spark__target" stroke-dasharray="3 4" />`;

  return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      ${targetLine}
      <path d="${path}" class="spark__line" fill="none" />
      <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(points[points.length - 1]).toFixed(1)}" r="2.5" class="spark__dot" />
    </svg>`;
}

/* A thin rule that fills up. Everything progress-shaped uses this. */
export function progressBar(fraction, { label = "", tone = "" } = {}) {
  const pct = clamp(Math.round((fraction || 0) * 100), 0, 100);
  return `<div class="bar ${tone ? "bar--" + tone : ""}" role="img" aria-label="${esc(label || pct + "% complete")}">
      <span class="bar__fill" style="width:${pct}%"></span>
    </div>`;
}

/* Seven little marks, one per weekday — used for standards. */
export function weekDots(doneDays) {
  const dots = DAYS_SHORT.map((day, i) => {
    const done = doneDays.includes(i);
    return `<span class="dots__dot ${done ? "is-done" : ""}" title="${day}"></span>`;
  }).join("");
  return `<span class="dots" aria-hidden="true">${dots}</span>`;
}

/* ---------------------------------------------------------------
   Images
   ---------------------------------------------------------------
   Topic covers are photos from a phone. Shrink them in the browser,
   otherwise a handful of covers outweighs everything else stored.
   --------------------------------------------------------------- */
export function readImage(file, { max = 1200, quality = 0.72 } = {}) {
  return new Promise((done, fail) => {
    if (!file || !file.type.startsWith("image/")) return fail(new Error("Not an image."));
    const reader = new FileReader();
    reader.onerror = () => fail(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => fail(new Error("Could not read that image."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------
   Theme
   --------------------------------------------------------------- */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;

  const dark = theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#15161a" : "#f7f4ef";
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
