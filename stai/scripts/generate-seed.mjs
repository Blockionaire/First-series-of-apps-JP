/**
 * Generate seeds/0001_verified_corpus.sql from the TypeScript corpus.
 *
 * Why generated rather than hand-written: the corpus lives in TypeScript
 * because that is where it is edited and type-checked, but production seeding
 * runs through `wrangler d1 execute --file`, which takes SQL. Generating keeps
 * one source of truth and makes the seed a reviewable artefact in the diff.
 *
 * Why the SQLite build's corrective migrations are absent: they corrected a
 * corpus that had already been seeded. A clean D1 database has no such history,
 * so the corrections are applied HERE, at generation time, and the database is
 * created correct instead of created wrong and then repaired:
 *
 *   - six articles built on fabricated research, invented enforcement actions
 *     or invented statistics are not seeded at all;
 *   - podcasts and research are empty (they named real institutions and real
 *     journals for episodes and papers that do not exist);
 *   - prompt `uses` counters are zero, not the seeded fiction;
 *   - prompt premium flags come from PREMIUM_PROMPT_SLUGS, not from the
 *     per-prompt defaults in the corpus file.
 *
 * Run: npm run seed:generate
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "seeds", "0001_verified_corpus.sql");

/**
 * Articles withheld from the corpus. Same list the SQLite build unpublished in
 * mig_content_trust_v1, with the same reasons. These are not deleted from the
 * repository — the writing is salvageable once the claims are sourced — they
 * are simply never published to a clean database.
 */
const WITHHELD = new Set([
  "afm-thematic-review-ai-audit-firms", // invented regulatory action, reported as news
  "esma-cra-model-governance-fine", // invented enforcement action and fine amount
  "iaasb-signals-isa-500-refresh", // unverifiable standard-setter news
  "copilot-audit-room-90-day-field-report", // fabricated first-person field study
  "materiality-for-model-risk", // invented industry statistics presented as convergence
  "big-four-ai-arms-race-audited", // unsourced characterisation of named real firms
]);

/** Single editorial byline. No invented personas, no invented credentials. */
const AUTHOR = "STAI Editorial";
const AUTHOR_ROLE = "Editorial desk";

// ── Load the TypeScript corpus by stripping types. The seed modules are plain
// data with `import type` lines and a single `export const`, so this is a
// deliberate, narrow transform rather than a general TS compiler.
function loadCorpus(file, exportName) {
  const src = fs.readFileSync(path.join(ROOT, "src/lib/seed", file), "utf8");
  const stripped = src
    .replace(/^\s*import\s+type[\s\S]*?;\s*$/gm, "")
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/:\s*Seed\w+\[\]/g, "")
    .replace(/:\s*Seed\w+\b/g, "")
    .replace(/\bexport const\b/g, "const");
  const mod = { exports: {} };
  const fn = new Function("module", "exports", `${stripped}\nmodule.exports = { ${exportName} };`);
  fn(mod, mod.exports);
  return mod.exports[exportName];
}

const articles = [
  ...loadCorpus("articles-1.ts", "articles1"),
  ...loadCorpus("articles-2.ts", "articles2"),
];
const promptsSrc = fs.readFileSync(path.join(ROOT, "src/lib/seed/prompts.ts"), "utf8");
const prompts = loadPrompts(promptsSrc);
const signals = loadCorpus("media.ts", "signals");
const gating = fs.readFileSync(path.join(ROOT, "src/lib/seed/gating.ts"), "utf8");
const PREMIUM = new Set([...gating.matchAll(/^\s*"([a-z0-9-]+)",\s*$/gm)].map((m) => m[1]));

/** prompts.ts builds entries through a helper, so evaluate it the same way. */
function loadPrompts(src) {
  const stripped = src
    .replace(/^\s*import\s+type[\s\S]*?;\s*$/gm, "")
    .replace(/:\s*Seed\w+\[\]/g, "")
    .replace(/:\s*Seed\w+\b/g, "")
    .replace(/:\s*string\[\]/g, "")
    .replace(/:\s*(string|number|boolean)\b/g, "")
    .replace(/\bexport const\b/g, "const");
  const mod = { exports: {} };
  new Function("module", "exports", `${stripped}\nmodule.exports = { prompts };`)(mod, mod.exports);
  return mod.exports.prompts;
}

// ── SQL emission ─────────────────────────────────────────────────────────
const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return "'" + String(v).replace(/'/g, "''") + "'";
};

/**
 * One guarded insert plus its ledger entry.
 *
 * The WHERE NOT EXISTS is the protection that matters: a slug the ledger has
 * already seen is never offered again, so an article renamed in the admin
 * editor is not resurrected under its old slug by the next deploy. INSERT OR
 * IGNORE is the second guard, for the case where the row exists but the ledger
 * does not. The ledger write is unconditional — the slug has been offered
 * whether or not a row resulted.
 */
function guarded(table, kind, slug, cols, vals) {
  return [
    `INSERT OR IGNORE INTO ${table} (${cols.join(", ")})`,
    `SELECT ${vals.map(q).join(", ")}`,
    `WHERE NOT EXISTS (SELECT 1 FROM seed_ledger WHERE kind = ${q(kind)} AND slug = ${q(slug)});`,
    `INSERT OR IGNORE INTO seed_ledger (kind, slug) VALUES (${q(kind)}, ${q(slug)});`,
  ].join("\n");
}

const out = [];
out.push(`-- GENERATED by scripts/generate-seed.mjs — do not edit by hand.
--
-- Initial content for a clean D1 database. Idempotent: every statement is
-- guarded by the seed_ledger, so applying this file twice changes nothing and
-- applying it after an editor has changed something changes nothing either.
--
-- This file NEVER updates. It only ever inserts a slug the database has not
-- been offered before. Editorial changes after the initial seed belong to the
-- admin editors and the database, which is the source of truth from then on.
--
-- Articles:  ${articles.length - WITHHELD.size} of ${articles.length} (${WITHHELD.size} withheld pending sourcing)
-- Prompts:   ${prompts.length} (${PREMIUM.size} behind the STAI+ gate)
-- Signals:   ${signals.length}
-- Podcasts:  0 — deliberately empty, see src/lib/seed/media.ts
-- Research:  0 — deliberately empty, see src/lib/seed/media.ts
`);

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

out.push("\n-- ─── Articles ───────────────────────────────────────────────────────────");
let seededArticles = 0;
for (const a of articles) {
  if (WITHHELD.has(a.slug)) {
    out.push(`\n-- withheld: ${a.slug}`);
    continue;
  }
  seededArticles++;
  out.push(
    "\n" +
      guarded(
        "articles",
        "article",
        a.slug,
        [
          "slug", "title", "dek", "category", "tags", "author", "author_role",
          "published_at", "reading_min", "featured", "urgency", "premium",
          "body_md", "status", "updated_at",
        ],
        [
          a.slug, a.title, a.dek, a.category, JSON.stringify(a.tags), AUTHOR, AUTHOR_ROLE,
          a.publishedAt, a.readingMin, a.featured, a.urgency, a.premium ? 1 : 0,
          a.body, "published",
        ]
      ).replace(/, NULL;/, "")
  );
}

out.push("\n\n-- ─── Prompts ────────────────────────────────────────────────────────────");
for (const p of prompts) {
  out.push(
    "\n" +
      guarded(
        "prompts",
        "prompt",
        p.slug,
        [
          "slug", "title", "category", "description", "body", "variables",
          "model_note", "premium", "uses", "status",
        ],
        [
          p.slug, p.title, p.category, p.description, p.body, JSON.stringify(p.variables),
          p.modelNote, PREMIUM.has(p.slug) ? 1 : 0, 0, "published",
        ]
      )
  );
}

out.push("\n\n-- ─── Ticker signals ─────────────────────────────────────────────────────");
out.push("-- Keyed by label: signals have no slug, and the label is what a reader sees.");
for (const s of signals) {
  out.push(
    "\n" +
      guarded(
        "signals",
        "signal",
        s.label,
        ["label", "detail", "kind", "published_at"],
        [s.label, s.detail, s.kind, s.publishedAt]
      )
  );
}

out.push(`

-- ─── Settings ───────────────────────────────────────────────────────────
--
-- The founding-seat counter MUST start at zero and is incremented only by real
-- subscriptions. Seeding it with a flattering number would be fabricated
-- scarcity — a prohibited practice under the EU Unfair Commercial Practices
-- Directive, and precisely what our own readers audit other companies for.
INSERT OR IGNORE INTO settings (key, value) VALUES ('founding_total', '200');
INSERT OR IGNORE INTO settings (key, value) VALUES ('founding_claimed', '0');
`);

// The article inserts carry a literal NOW for updated_at; splice it in so the
// timestamp is evaluated by the database rather than frozen at generation.
const sql = out.join("\n").replace(/, 'published'\n(WHERE NOT EXISTS \(SELECT 1 FROM seed_ledger WHERE kind = 'article')/g,
  `, 'published', ${NOW}\n$1`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, sql.trimStart() + "\n");

console.log(`seeds/0001_verified_corpus.sql`);
console.log(`  articles : ${seededArticles} seeded, ${WITHHELD.size} withheld`);
console.log(`  prompts  : ${prompts.length} (${PREMIUM.size} premium)`);
console.log(`  signals  : ${signals.length}`);
console.log(`  bytes    : ${fs.statSync(OUT).size}`);
