import { interestLabel } from "./earlyaccess";
import { FIRM_INTERESTS } from "./firms";

/**
 * Every list of people the back office can show, in one place.
 *
 * The register page, the CSV exporter and the desk's tile links all read this
 * registry, so a dataset is described once and cannot drift between the screen
 * and the download.
 *
 * ── Why the SQL lives here as literal strings ────────────────────────────
 * Nothing a caller sends ever reaches a query. A request names a dataset and
 * optionally a filter; both are looked up in this file by exact id, and what
 * runs is the text written below. There is no interpolation of user input
 * anywhere in this module, which is the property that makes a URL-driven
 * exporter safe to expose at all.
 *
 * `users.password_hash` is deliberately absent from the accounts SELECT.
 * Selecting it would put hashes in a CSV that gets mailed around; there is no
 * admin question it helps answer.
 */

export type Row = Record<string, unknown>;

export type Column = {
  key: string;
  header: string;
  /** Rendered instead of the raw value, in both the table and the CSV. */
  format?: (row: Row) => string;
  /** Monospace + tabular numerals — dates, scores, references. */
  mono?: boolean;
};

export type Filter = {
  id: string;
  label: string;
  /** A literal SQL fragment from this file. Never built from a request. */
  where?: string;
};

export type Dataset = {
  id: string;
  /** Tab label. */
  label: string;
  /** One line under the heading: what this list is and where it comes from. */
  blurb: string;
  /** The table to COUNT for the total. */
  from: string;
  /** Columns, in display order. */
  columns: Column[];
  /** Only accounts has these today. */
  filters?: { param: string; options: Filter[] };
};

const str = (v: unknown) => (v == null ? "" : String(v));
/** "2026-09-19T14:22:31.000Z" and "2026-09-19 14:22:31" both cut to the minute. */
const stamp = (v: unknown) => str(v).replace("T", " ").slice(0, 16);

/** Interests are stored as a JSON array; a malformed one must not break a page. */
function labelled(raw: unknown, label: (id: string) => string): string {
  try {
    const ids = JSON.parse(str(raw));
    return Array.isArray(ids) ? ids.map((i) => label(String(i))).join(", ") : "";
  } catch {
    return "";
  }
}

const firmInterestLabel = (id: string) => FIRM_INTERESTS.find((i) => i.id === id)?.label ?? id;

/** STAI-FRM-0007 and friends — the reference the enquiry tables already show. */
const ref = (prefix: string) => (r: Row) => `STAI-${prefix}-${String(r.id ?? "").padStart(4, "0")}`;

export const DATASETS: Dataset[] = [
  {
    id: "accounts",
    label: "Accounts",
    blurb: "Everyone who created a STAI account, newest first.",
    from: "users",
    filters: {
      param: "plan",
      options: [
        { id: "all", label: "All" },
        { id: "plus", label: "STAI+", where: "plan='plus'" },
        { id: "free", label: "Free", where: "plan='free'" },
        { id: "admin", label: "Admins", where: "role='admin'" },
      ],
    },
    columns: [
      { key: "created_at", header: "Joined", format: (r) => stamp(r.created_at), mono: true },
      { key: "email", header: "Email" },
      { key: "name", header: "Name" },
      { key: "firm", header: "Firm" },
      { key: "plan", header: "Plan", mono: true },
      { key: "role", header: "Role", mono: true },
      { key: "founding", header: "Founding", format: (r) => (Number(r.founding) ? "yes" : ""), mono: true },
    ],
  },
  {
    id: "newsletter",
    label: "Brief subscribers",
    blurb: "Addresses on the Briefing list. `source` records which form they came through.",
    from: "newsletter",
    columns: [
      { key: "created_at", header: "Joined", format: (r) => stamp(r.created_at), mono: true },
      { key: "email", header: "Email" },
      { key: "source", header: "Source", mono: true },
    ],
  },
  {
    id: "assessments",
    label: "Assessments",
    blurb: "Every AI-readiness assessment run, with the score and band it produced.",
    from: "assessments",
    columns: [
      { key: "created_at", header: "Run", format: (r) => stamp(r.created_at), mono: true },
      { key: "score", header: "Score", mono: true },
      { key: "band", header: "Band" },
      { key: "email", header: "Email" },
      { key: "firm", header: "Firm" },
      { key: "firm_size", header: "Size" },
      { key: "jurisdiction", header: "Jurisdiction" },
      { key: "role", header: "Role" },
    ],
  },
  {
    id: "firm-enquiries",
    label: "Firm enquiries",
    blurb: "Firms that asked about a rollout, and which capabilities they asked for.",
    from: "firm_enquiries",
    columns: [
      { key: "id", header: "Ref", format: ref("FRM"), mono: true },
      { key: "created_at", header: "Logged", format: (r) => stamp(r.created_at), mono: true },
      { key: "firm", header: "Firm" },
      { key: "firm_size", header: "Size" },
      { key: "jurisdiction", header: "Jurisdiction" },
      { key: "name", header: "Contact" },
      { key: "email", header: "Email" },
      { key: "role", header: "Role" },
      { key: "interests", header: "Wants", format: (r) => labelled(r.interests, firmInterestLabel) },
      { key: "seats", header: "Seats" },
    ],
  },
  {
    id: "training-enquiries",
    label: "Training enquiries",
    blurb: "Requests that came in through the training programme forms.",
    from: "enquiries",
    columns: [
      { key: "id", header: "Ref", format: ref("TRN"), mono: true },
      { key: "created_at", header: "Logged", format: (r) => stamp(r.created_at), mono: true },
      { key: "name", header: "From" },
      { key: "email", header: "Email" },
      { key: "firm", header: "Firm" },
      { key: "programme", header: "Programme" },
      { key: "seats", header: "Seats" },
      { key: "status", header: "Status", mono: true },
    ],
  },
  {
    id: "early-access",
    label: "STAI+ early access",
    blurb: "The STAI+ waiting list. The demand ranking for these sits on Growth.",
    from: "early_access",
    columns: [
      { key: "created_at", header: "Joined", format: (r) => stamp(r.created_at), mono: true },
      { key: "email", header: "Email" },
      { key: "name", header: "Name" },
      { key: "firm", header: "Firm" },
      { key: "role", header: "Role" },
      { key: "interests", header: "Wants", format: (r) => labelled(r.interests, interestLabel) },
      { key: "note", header: "Note" },
    ],
  },
];

export function dataset(id: string | undefined): Dataset | undefined {
  return DATASETS.find((d) => d.id === id);
}

export function filterFor(d: Dataset, value: string | undefined): Filter | undefined {
  return d.filters?.options.find((o) => o.id === value);
}

/** The value a column shows, identical on screen and in the CSV. */
export function cellValue(c: Column, r: Row): string {
  return c.format ? c.format(r) : str(r[c.key]);
}

/**
 * The SELECT for a dataset. Built only from this file's own strings: the
 * column list comes from the registry and the WHERE from a matched filter,
 * so a request can choose between these queries but never compose one.
 */
export function buildQuery(d: Dataset, filter?: Filter): string {
  const cols = [...new Set(d.columns.map((c) => c.key))].join(", ");
  const where = filter?.where ? ` WHERE ${filter.where}` : "";
  return `SELECT ${cols} FROM ${d.from}${where} ORDER BY id DESC`;
}

export function buildCountQuery(d: Dataset, filter?: Filter): string {
  const where = filter?.where ? ` WHERE ${filter.where}` : "";
  return `SELECT COUNT(*) AS n FROM ${d.from}${where}`;
}

/**
 * One CSV field.
 *
 * The leading-character guard is the important part: a spreadsheet treats a
 * cell starting with =, +, - or @ as a formula, so an address like
 * `=HYPERLINK(...)@example.com` would execute on open. Prefixing an
 * apostrophe makes it text. This came from the early-access exporter and is
 * shared so a new export cannot quietly omit it.
 */
export function csvCell(v: string): string {
  const s = String(v ?? "");
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(d: Dataset, rows: Row[]): string {
  const header = d.columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => d.columns.map((c) => csvCell(cellValue(c, r))).join(",")).join("\n");
  return `${header}\n${body}\n`;
}
