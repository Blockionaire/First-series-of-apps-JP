import { settingsSnapshot } from "./settings";

/** One setting from this request's snapshot; null when the row does not exist. */
async function readSetting(key: string): Promise<string | null> {
  return (await settingsSnapshot()).get(key) ?? null;
}

/**
 * What the operator can change without a deploy.
 *
 * Three kinds of thing live here, all backed by the `settings` key/value
 * table: which pages and features are switched on, the homepage's own words
 * and calls to action, and the quotas that gate anonymous and free readers.
 *
 * ── Every value has a code-level default ─────────────────────────────────
 * Nothing here requires a row to exist. An unset key falls back to the
 * constant written beside it, which is the value the site shipped with. That
 * matters for three reasons: a fresh database renders a complete site, a
 * failed write never blanks a headline, and the defaults stay readable as
 * documentation of what the page is supposed to say.
 *
 * ── Why a registry rather than scattered per-key reads ───────────────────
 * The admin screen, the navigation filter, the route guards, the sitemap and
 * the feed all need to agree on what exists and what it is called. A single
 * list means adding a switch is one entry, and it is impossible to ship a
 * toggle the admin screen cannot reach or a page the sitemap forgets to drop.
 */

/* ── Toggles ──────────────────────────────────────────────────────────── */

export type Toggle = {
  /** Settings key, and the id used in URLs and tests. */
  id: string;
  label: string;
  /** What switching this off actually does, in the operator's words. */
  blurb: string;
  /** The public path this guards. Absent for features that are not a page. */
  path?: string;
  /** Shipped state. */
  on: boolean;
};

/**
 * `path` is what the guard, the nav filter and the sitemap all key on, so a
 * page cannot be half-disabled: hidden in the nav but still reachable, or
 * blocked but still advertised in the sitemap.
 */
export const TOGGLES: Toggle[] = [
  { id: "news", label: "News", path: "/news", on: true, blurb: "The index of timely pieces." },
  { id: "insights", label: "Insights", path: "/insights", on: true, blurb: "Deeper analysis, standing rather than timely." },
  { id: "prompts", label: "Prompt library", path: "/prompts", on: true, blurb: "The prompt library and every prompt page." },
  { id: "podcast", label: "Podcast hub", path: "/podcast", on: true, blurb: "The episode hub." },
  { id: "plus", label: "STAI+", path: "/plus", on: true, blurb: "The membership page and its waiting list." },
  { id: "ask", label: "Ask STAI", path: "/ask", on: false, blurb: "The research assistant. Off until it is ready to meet readers." },
  { id: "aiAct", label: "AI Act tracker", path: "/ai-act", on: true, blurb: "The enforcement tracker." },
  { id: "training", label: "Training", path: "/training", on: true, blurb: "Training programmes and the enquiry form." },
  { id: "firms", label: "For firms", path: "/firms", on: true, blurb: "The B2B page and its enquiry form." },
  { id: "assessment", label: "AI-readiness assessment", path: "/assessment", on: true, blurb: "The assessment and its scoring." },
  { id: "research", label: "Research desk", path: "/research", on: true, blurb: "The research index." },
  { id: "newsletter", label: "Brief sign-up", on: true, blurb: "The newsletter form in the footer and on the homepage. Off hides the form; nothing already collected is touched." },
  /**
   * The scheduled newsroom crawl.
   *
   * OFF by default, and it is the switch the cron trigger reads. That lets the
   * trigger be deployed before a single source has been approved: it fires,
   * finds discovery switched off, logs why and does nothing. Same rule as the
   * source registry, applied to the schedule — the machinery ships dormant and
   * a person starts it.
   *
   * Off does not disable the manual "Run discovery now" button, which is an
   * operator deliberately asking for one run.
   */
  { id: "discovery", label: "Newsroom discovery (scheduled)", on: false, blurb: "The cron-driven crawl of approved sources. Off means the schedule fires and does nothing; the manual run button still works. Nothing is fetched from a source that is not both active and retrievable." },
];

const toggleKey = (id: string) => `page.${id}.enabled`;

export function toggle(id: string): Toggle | undefined {
  return TOGGLES.find((t) => t.id === id);
}

function enabledIn(snapshot: ReadonlyMap<string, string>, t: Toggle): boolean {
  const v = snapshot.get(toggleKey(t.id));
  return v === undefined ? t.on : v === "1";
}

/** Current state of one switch. Unset means the shipped default. */
export async function isEnabled(id: string): Promise<boolean> {
  const t = toggle(id);
  if (!t) return false;
  return enabledIn(await settingsSnapshot(), t);
}

/**
 * Every switch at once — one pass for the nav, the sitemap and the admin.
 *
 * Takes ONE snapshot and reads every switch from it, rather than calling
 * isEnabled per switch: outside a render (the sitemap route, a route handler)
 * React does not memoise, and thirteen isEnabled calls would be thirteen reads.
 */
export async function enabledMap(): Promise<Record<string, boolean>> {
  const snapshot = await settingsSnapshot();
  return Object.fromEntries(TOGGLES.map((t) => [t.id, enabledIn(snapshot, t)]));
}

/** The switch guarding a path, if any. Longest match wins so /news/x is covered by /news. */
export function toggleForPath(path: string): Toggle | undefined {
  return TOGGLES.filter((t) => t.path && (path === t.path || path.startsWith(`${t.path}/`))).sort(
    (a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0)
  )[0];
}

/* ── Homepage copy and calls to action ────────────────────────────────── */

export type TextField = { key: string; label: string; fallback: string; multiline?: boolean; help?: string };

export const HOME_FIELDS: TextField[] = [
  { key: "home.eyebrow", label: "Eyebrow", fallback: "" , help: "Leave empty for “The intelligence layer for AI in audit”." },
  { key: "home.headline", label: "Headline", fallback: "AI is rewriting the audit.", help: "The first line, in full-strength ink." },
  { key: "home.headline2", label: "Headline, second line", fallback: "Stay the one who checks.", help: "Set in the muted shade under the first." },
  { key: "home.sub", label: "Standfirst", fallback: "The intelligence layer for AI in audit, accountancy and finance — sourced, dated, and written for the people who sign off.", multiline: true },
  { key: "home.cta1.label", label: "Primary button", fallback: "Explore the latest intelligence" },
  { key: "home.cta1.href", label: "Primary button link", fallback: "/news" },
  { key: "home.cta2.label", label: "Secondary button", fallback: "Join The Briefing" },
  { key: "home.cta2.href", label: "Secondary button link", fallback: "#briefing" },
];

function textIn(snapshot: ReadonlyMap<string, string>, key: string): string {
  const field = HOME_FIELDS.find((f) => f.key === key);
  const v = snapshot.get(key);
  const value = v === undefined ? field?.fallback ?? "" : v;
  return value.trim();
}

/** Reads one field, falling back to what the site shipped with. */
export async function text(key: string): Promise<string> {
  return textIn(await settingsSnapshot(), key);
}

/** Every homepage field from one snapshot, so the page makes one read. */
export async function homeCopy(): Promise<Record<string, string>> {
  const snapshot = await settingsSnapshot();
  return Object.fromEntries(HOME_FIELDS.map((f) => [f.key, textIn(snapshot, f.key)]));
}

/* ── Reader limits ────────────────────────────────────────────────────── */

export type LimitField = { key: string; label: string; fallback: number; help: string; min: number; max: number };

/**
 * The gates on Ask STAI.
 *
 * These were constants in the route. They are settings now because they are a
 * pricing decision, not an engineering one — and because the ceiling is the
 * only thing standing between a free launch and an unbounded model bill.
 */
export const LIMIT_FIELDS: LimitField[] = [
  {
    key: "limit.ask.anon",
    label: "Ask STAI — signed out",
    fallback: 2,
    min: 0,
    max: 50,
    help: "Questions per month for a reader with no account. 0 closes the taste entirely.",
  },
  {
    key: "limit.ask.free",
    label: "Ask STAI — free account",
    fallback: 5,
    min: 0,
    max: 200,
    help: "Questions per month for a signed-in free account. STAI+ is unmetered.",
  },
  {
    key: "limit.ask.ceiling",
    label: "Ask STAI — platform ceiling",
    fallback: 5000,
    min: 0,
    max: 1_000_000,
    help: "Model calls per month across everyone. On breach Ask STAI serves cited passages instead of generated answers — readers keep getting citations, the bill stops growing.",
  },

  /* ── Newsroom ───────────────────────────────────────────────────────────
   * The volume targets are CONFIGURED, not designed in (masterplan decision
   * D2). 1–3 a day is the validation setting, not a limit of the system:
   * raising it after the dry run is an edit here, not a change to the schema,
   * the state machine or any workflow.
   *
   * The research cap and the budget move together. Raising the publish target
   * without raising the ceiling only produces more rejected drafts, which cost
   * the same as published ones.
   */
  {
    key: "newsroom.research_cap_per_day",
    label: "Newsroom — stories researched per day",
    fallback: 8,
    min: 0,
    max: 50,
    help: "The throttle. Research is capped by COUNT, not by a relevance threshold, so a quiet news day yields fewer candidates instead of filler and a heavy one cannot overspend. Shrinks automatically when the month's budget is running ahead. 0 pauses research entirely.",
  },
  {
    key: "newsroom.publish_target_min",
    label: "Newsroom — publish target, minimum",
    fallback: 1,
    min: 0,
    max: 20,
    help: "Lower end of the daily publishing target during validation. A target, not a quota — the engine never pads to reach it.",
  },
  {
    key: "newsroom.publish_target_max",
    label: "Newsroom — publish target, maximum",
    fallback: 3,
    min: 0,
    max: 20,
    help: "Upper end of the daily publishing target. Expected to move to 5 after the dry run if the quality KPIs hold.",
  },

  /* ── Discovery safety limits ────────────────────────────────────────────
   * What one discovery run may spend. The platform allows far more (Workers
   * Paid: 1,000 D1 queries, 10,000 subrequests, minutes of CPU per
   * invocation); these are deliberately much lower, because a run that is
   * suddenly doing ten times the work is a fault to notice, not a load to
   * absorb. A source a limit holds back is logged as `skipped_budget` and is
   * still due next run — nothing is dropped.
   *
   * `max` is a HARD cap: the admin form cannot store more, and the reader
   * clamps whatever is in the table. It holds on Paid too — no setting can
   * turn discovery into a runaway. On Workers Free a manual run is clamped
   * further still (src/lib/newsroom/plan.ts).
   */
  {
    key: "newsroom.max_sources_per_run",
    label: "Discovery — sources fetched per run",
    fallback: 60,
    min: 1,
    max: 200,
    help: "At most this many due sources are fetched in one run; the least recently attempted go first and the rest wait for the next run. One outbound request each.",
  },
  {
    key: "newsroom.max_detail_fetches_per_run",
    label: "Discovery — detail pages fetched per run",
    fallback: 60,
    min: 0,
    max: 300,
    help: "Across all sources in one run, the most publication pages opened behind an index (each extractor also has its own smaller cap). One outbound request each.",
  },
  {
    key: "newsroom.max_run_seconds",
    label: "Discovery — time budget per run (seconds)",
    fallback: 300,
    min: 30,
    max: 840,
    help: "No new source or detail page is started after this. Keeps a run well inside the scheduled handler's limits even if every source is slow; what is left is picked up next run.",
  },
];

/**
 * A numeric limit, clamped to its declared range.
 *
 * The clamp is not defensive dressing: these bound spend, and a stray value in
 * the settings table — a paste, a bad edit, a future bug in the admin form —
 * must not be able to lift the ceiling. Anything unparseable falls back to the
 * shipped default rather than to zero or to infinity.
 */
export async function limit(key: string): Promise<number> {
  const field = LIMIT_FIELDS.find((f) => f.key === key);
  if (!field) return 0;
  const raw = await readSetting(key);
  if (raw === null) return field.fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return field.fallback;
  return Math.min(Math.max(n, field.min), field.max);
}

/**
 * Several limits from ONE settings read.
 *
 * `limit()` reads a snapshot per call; outside a render (the cron, a route
 * handler) each call is its own query. A discovery run needs four limits and
 * spends one query on all of them.
 */
export async function limits<K extends string>(keys: readonly K[]): Promise<Record<K, number>> {
  const snapshot = await settingsSnapshot();
  const out = {} as Record<K, number>;
  for (const key of keys) {
    const field = LIMIT_FIELDS.find((f) => f.key === key);
    if (!field) {
      out[key] = 0;
      continue;
    }
    const raw = snapshot.get(key);
    const n = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
    out[key] = Number.isFinite(n) ? Math.min(Math.max(n, field.min), field.max) : field.fallback;
  }
  return out;
}

/* ── Writing ──────────────────────────────────────────────────────────── */

export const SETTING_KEYS = [
  ...TOGGLES.map((t) => toggleKey(t.id)),
  ...HOME_FIELDS.map((f) => f.key),
  ...LIMIT_FIELDS.map((f) => f.key),
];

/** True if a key is one this module owns — the allowlist the admin API uses. */
export function isKnownKey(key: string): boolean {
  return SETTING_KEYS.includes(key);
}

export { toggleKey };
