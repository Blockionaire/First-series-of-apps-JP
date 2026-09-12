import type Database from "better-sqlite3";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { articles1 } from "./articles-1";
import { articles2 } from "./articles-2";
import { prompts } from "./prompts";
import { podcasts, research, signals } from "./media";

/**
 * Slugs this database has already been offered by a previous seed run.
 *
 * `ON CONFLICT(slug) DO NOTHING` protects a row only while it still carries
 * its seeded slug. An editor who renames `engagement-risk-brainstorm` in
 * /admin/prompts frees that slug, and the next seed-version bump would happily
 * insert the original back — a duplicate of a prompt that was deliberately
 * moved. The ledger closes that: a slug is offered exactly once per database,
 * ever, and what happens to the row afterwards is the editor's business.
 */
function alreadySeeded(d: Database.Database, key: string): Set<string> {
  const row = d.prepare("SELECT value FROM settings WHERE key=?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return new Set();
  try {
    return new Set(JSON.parse(row.value) as string[]);
  } catch {
    return new Set();
  }
}

function rememberSeeded(d: Database.Database, key: string, slugs: Set<string>) {
  d.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, JSON.stringify([...slugs]));
}

export function runSeed(d: Database.Database, seedVersion: string) {
  const tx = d.transaction(() => {
    // Seeding is ADDITIVE. It must never destroy work done in the CMS: a
    // seed-version bump used to wipe every editor-authored article. Rows are
    // matched by slug and left alone if they already exist; deliberate changes
    // to seeded rows go through runDataMigrations in db.ts instead.
    //
    // Note what is deliberately NOT in either INSERT column list: `status`.
    // A first insert takes the column default ('published'); an existing row
    // keeps whatever the editor set. Seeding can therefore never republish a
    // prompt or article that was taken down on purpose.
    const seenArticles = alreadySeeded(d, "seeded_article_slugs");
    const insArticle = d.prepare(`
      INSERT INTO articles (slug, title, dek, category, tags, author, author_role, published_at, reading_min, featured, urgency, premium, body_md)
      VALUES (@slug, @title, @dek, @category, @tags, @author, @authorRole, @publishedAt, @readingMin, @featured, @urgency, @premium, @body)
      ON CONFLICT(slug) DO NOTHING
    `);
    for (const a of [...articles1, ...articles2]) {
      if (seenArticles.has(a.slug)) continue;
      insArticle.run({
        ...a,
        tags: JSON.stringify(a.tags),
        premium: a.premium ? 1 : 0,
      });
      seenArticles.add(a.slug);
    }
    rememberSeeded(d, "seeded_article_slugs", seenArticles);

    const seenPrompts = alreadySeeded(d, "seeded_prompt_slugs");
    const insPrompt = d.prepare(`
      INSERT INTO prompts (slug, title, category, description, body, variables, model_note, premium, uses)
      VALUES (@slug, @title, @category, @description, @body, @variables, @modelNote, @premium, @uses)
      ON CONFLICT(slug) DO NOTHING
    `);
    for (const pr of prompts) {
      if (seenPrompts.has(pr.slug)) continue;
      insPrompt.run({
        ...pr,
        variables: JSON.stringify(pr.variables),
        premium: pr.premium ? 1 : 0,
      });
      seenPrompts.add(pr.slug);
    }
    rememberSeeded(d, "seeded_prompt_slugs", seenPrompts);

    const insPod = d.prepare(`
      INSERT INTO podcasts (slug, episode_no, title, guest, description, duration_min, published_at)
      VALUES (@slug, @episodeNo, @title, @guest, @description, @durationMin, @publishedAt)
      ON CONFLICT(slug) DO NOTHING
    `);
    for (const ep of podcasts) insPod.run(ep);

    const insRes = d.prepare(`
      INSERT INTO research (slug, title, source, authors, year, topic, summary, takeaway)
      VALUES (@slug, @title, @source, @authors, @year, @topic, @summary, @takeaway)
      ON CONFLICT(slug) DO NOTHING
    `);
    for (const r of research) insRes.run(r);

    // Signals have no natural key; only seed them into an empty ticker.
    const sigCount = (d.prepare("SELECT COUNT(*) n FROM signals").get() as { n: number }).n;
    if (sigCount === 0) {
      const insSig = d.prepare(`
        INSERT INTO signals (label, detail, kind, published_at)
        VALUES (@label, @detail, @kind, @publishedAt)
      `);
      for (const s of signals) insSig.run(s);
    }

    // Founding member scarcity.
    //
    // This counter MUST start at zero. It is incremented only by real
    // subscriptions (see activateSubscription). Seeding it with a flattering
    // number would be fabricated scarcity — a prohibited practice under the
    // EU Unfair Commercial Practices Directive, and precisely the kind of
    // thing our own readers audit other companies for. Do not "prime" it.
    const set = d.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    );
    const getS = d.prepare("SELECT value FROM settings WHERE key=?");
    set.run("founding_total", process.env.STAI_FOUNDING_TOTAL ?? "200");
    if (!getS.get("founding_claimed")) set.run("founding_claimed", "0");

    // Editorial admin account.
    //
    // Never ship a default password. Without explicit credentials we create
    // no admin at all: a live site with a documented fallback login is a
    // handed-over CMS. Bootstrap production by setting both env vars once.
    const adminEmail = process.env.STAI_ADMIN_EMAIL;
    const adminPass = process.env.STAI_ADMIN_PASSWORD;
    if (adminEmail && adminPass && adminPass.length >= 12) {
      d.prepare(
        "INSERT INTO users (email, password_hash, name, firm, role, plan) VALUES (?, ?, 'The Desk', 'STAI', 'admin', 'plus') ON CONFLICT(email) DO NOTHING"
      ).run(adminEmail.toLowerCase().trim(), bcrypt.hashSync(adminPass, 10));
    } else if (process.env.NODE_ENV !== "production") {
      // Development convenience only, and loudly announced. The password is
      // random per database, so nothing guessable ever reaches a deployment.
      const devPass = crypto.randomBytes(9).toString("base64url");
      d.prepare(
        "INSERT INTO users (email, password_hash, name, firm, role, plan) VALUES (?, ?, 'The Desk', 'STAI', 'admin', 'plus') ON CONFLICT(email) DO NOTHING"
      ).run("desk@stai.ai", bcrypt.hashSync(devPass, 10));
      console.warn(
        `\n[STAI] Dev admin created: desk@stai.ai / ${devPass}\n` +
          `[STAI] Set STAI_ADMIN_EMAIL and STAI_ADMIN_PASSWORD (12+ chars) for a real deployment.\n`
      );
    } else {
      console.warn(
        "[STAI] No admin account created: set STAI_ADMIN_EMAIL and STAI_ADMIN_PASSWORD (12+ chars) to bootstrap the content desk."
      );
    }

    set.run("seed_version", seedVersion);
  });
  tx();
}
