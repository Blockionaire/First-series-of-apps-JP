import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { guard, WINDOW } from "@/lib/ratelimit";
import {
  allSources,
  createSource,
  recordProbe,
  setSourceActive,
  setSourceFetchAllowed,
  setSourceReviewStatus,
  sourceById,
  updateSourceDetails,
  updateSourceFeedUrl,
} from "@/lib/newsroom/store";
import { proposedAsSourceCreates } from "@/lib/newsroom/proposed-sources";
import {
  describeSourceChanges,
  feedUrlBelongsTo,
  isReviewStatus,
  validateSource,
} from "@/lib/newsroom/sources";
import { probeFeed } from "@/lib/newsroom/probe";

/**
 * The source registry's write path.
 *
 * Four actions, and what they deliberately cannot do matters as much as what
 * they can:
 *
 *   load_proposal — registers the proposed list. Every row lands `active = 0`
 *                   and `fetch_allowed = 0`. There is no parameter that would
 *                   change that, because "seed and enable" in one call is
 *                   exactly how a reviewed allowlist becomes an unreviewed
 *                   crawl.
 *   set_flag      — flips `active` or `fetch_allowed` on ONE source, recording
 *                   who did it. No id list, no "all" — fifty sources approved
 *                   in one click is fifty sources nobody read.
 *   set_feed_url  — corrects a moved feed. Validated by the same function that
 *                   guards registration, and it RESETS retrieval permission,
 *                   because permission was granted for the old address.
 *   set_review    — records what a human concluded. Advisory: it is not read
 *                   by the fetcher, and it cannot grant retrieval.
 *   update_details — corrects name, type, tier, jurisdictions, frequency,
 *                   retention and licence notes. Validated like `create`;
 *                   never the domain, URL or method, and it leaves both
 *                   permissions as they were. Every change is logged.
 *   test_source   — the ONE action here that makes an outbound request. See
 *                   the note on it below.
 *   create        — registers one hand-entered source, validated.
 *
 * Apart from `test_source`, nothing here fetches anything. Correcting a URL
 * does not test it; the next discovery run does, and reports what it found.
 */

export async function POST(req: NextRequest) {
  // Unauthenticated burst protection, keyed on the caller's IP because at this
  // point we do not yet know who they are. It has to sit ABOVE the per-admin
  // probe budget below, not compete with it: verifying a registry means a
  // hundred Test source calls interleaved with the flag, review and URL edits
  // that follow each one, and a shared 120 would refuse the work at roughly
  // the halfway mark while the probe counter still showed headroom.
  const blocked = await guard(req, "admin-newsroom-source", 400, WINDOW.hour);
  if (blocked) return blocked;

  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");

  if (action === "load_proposal") {
    // Idempotent by the registry's own UNIQUE(domain): re-running skips what
    // is already registered rather than duplicating it or failing the batch.
    // A duplicate domain is not an error worth stopping for — it means the row
    // is already there, which is the desired end state.
    const existing = new Set((await allSources()).map((s) => s.domain));
    let inserted = 0;
    const rejected: string[] = [];

    for (const candidate of proposedAsSourceCreates()) {
      if (existing.has(candidate.domain)) continue;

      // Validated on the way in, not trusted because it shipped in the repo.
      // A malformed proposal entry should fail here, visibly, rather than sit
      // in the registry looking approved.
      const check = validateSource(candidate);
      if (!check.ok) {
        rejected.push(`${candidate.name}: ${check.error}`);
        continue;
      }
      await createSource({
        ...check.value,
        authority_tier: check.value.authority_tier,
      });
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted, rejected });
  }

  if (action === "set_flag") {
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A source id is required" }, { status: 400 });
    }
    const field = String(b.field ?? "");
    const value = b.value === true;

    if (field === "active") {
      await setSourceActive(id, value, user.email);
      return NextResponse.json({ ok: true });
    }
    if (field === "fetch_allowed") {
      await setSourceFetchAllowed(id, value);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: `Unknown field: ${field}` }, { status: 400 });
  }

  if (action === "set_feed_url") {
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A source id is required" }, { status: 400 });
    }
    const source = await sourceById(id);
    if (!source) return NextResponse.json({ error: "No such source" }, { status: 404 });

    const feed_url = String(b.feed_url ?? "").trim();
    if (!feed_url) {
      return NextResponse.json({ error: "A feed URL is required" }, { status: 400 });
    }

    // Validated by the SAME function that guards registration, against the
    // source's own existing fields. That is what keeps the rules identical:
    // https only, and the feed must belong to the registered domain, so a
    // correction cannot quietly repoint a Tier-1 row at somebody's blog.
    // The retrieval method travels with the address. A source registered as
    // `html_scrape` whose real feed has now been found would otherwise keep
    // being skipped as unsupported however correct its URL is — verified,
    // approved, active and silently never fetched.
    const ingestion_method = String(b.ingestion_method ?? "").trim() || source.ingestion_method;

    const check = validateSource({
      name: source.name,
      domain: source.domain,
      source_type: source.source_type,
      authority_tier: source.authority_tier,
      jurisdictions: source.jurisdictions,
      topics: source.topics,
      ingestion_method,
      feed_url,
      fetch_frequency: source.fetch_frequency,
      license_notes: source.license_notes,
      snapshot_retention: source.snapshot_retention,
    });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    await updateSourceFeedUrl({
      id,
      feedUrl: check.value.feed_url,
      ingestionMethod: check.value.ingestion_method,
      actor: user.email,
    });
    return NextResponse.json({
      ok: true,
      feed_url: check.value.feed_url,
      ingestion_method: check.value.ingestion_method,
    });
  }

  if (action === "update_details") {
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A source id is required" }, { status: 400 });
    }
    const source = await sourceById(id);
    if (!source) return NextResponse.json({ error: "No such source" }, { status: 404 });

    // A field left out keeps its current value; one sent is validated by the
    // SAME function as registration. Domain, feed URL and method are taken
    // from the stored row and cannot be changed here: the URL has its own
    // action because moving it resets retrieval permission.
    const check = validateSource({
      name: b.name === undefined ? source.name : String(b.name),
      domain: source.domain,
      source_type: b.source_type === undefined ? source.source_type : String(b.source_type),
      authority_tier: b.authority_tier === undefined ? source.authority_tier : Number(b.authority_tier),
      jurisdictions: Array.isArray(b.jurisdictions) ? b.jurisdictions.map(String) : source.jurisdictions,
      topics: source.topics,
      ingestion_method: source.ingestion_method,
      feed_url: source.feed_url,
      fetch_frequency: b.fetch_frequency === undefined ? source.fetch_frequency : Number(b.fetch_frequency),
      license_notes: b.license_notes === undefined ? source.license_notes : String(b.license_notes),
      snapshot_retention:
        b.snapshot_retention === undefined ? source.snapshot_retention : String(b.snapshot_retention),
    });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const v = check.value;
    const after = {
      name: v.name,
      source_type: v.source_type,
      authority_tier: v.authority_tier,
      jurisdictions: v.jurisdictions,
      fetch_frequency: v.fetch_frequency,
      snapshot_retention: v.snapshot_retention,
      license_notes: v.license_notes,
    };
    const changes = describeSourceChanges(
      {
        name: source.name,
        source_type: source.source_type,
        authority_tier: source.authority_tier,
        jurisdictions: source.jurisdictions,
        fetch_frequency: source.fetch_frequency,
        snapshot_retention: source.snapshot_retention,
        license_notes: source.license_notes,
      },
      after
    );
    if (!changes) return NextResponse.json({ ok: true, changes: "" });

    await updateSourceDetails({ id, ...after, actor: user.email, changes });
    return NextResponse.json({ ok: true, changes });
  }

  if (action === "set_review") {
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A source id is required" }, { status: 400 });
    }
    const status = String(b.status ?? "");
    if (!isReviewStatus(status)) {
      return NextResponse.json({ error: `Unknown review status: ${status}` }, { status: 400 });
    }
    if (!(await sourceById(id))) {
      return NextResponse.json({ error: "No such source" }, { status: 404 });
    }
    await setSourceReviewStatus({
      id,
      status,
      note: String(b.note ?? ""),
      actor: user.email,
    });
    return NextResponse.json({ ok: true, status });
  }

  /**
   * Look at a candidate feed once, without approving anything.
   *
   * ── Why this may run on a source that is off ────────────────────────
   * The registry asks an operator to decide whether a URL is worth approving,
   * and until now the only way to find out was to approve it. This inverts
   * that: one request, initiated by a named admin, nothing ingested, nothing
   * stored but the diagnosis. That is much closer to opening the link in a
   * browser tab — which is what the operator would otherwise do — than to
   * crawling, so it does not require `active` or `fetch_allowed`.
   *
   * ── Why it is not a request-forgery hole ────────────────────────────
   * The URL is not free text. It must belong to the registered source's own
   * domain, by the same `feedUrlBelongsTo` rule that governs what may be
   * STORED as a feed URL. So the furthest an admin can aim this is a different
   * path on a publisher already in the registry — not at an internal address,
   * a cloud metadata endpoint, or another origin's cookies. An admin who
   * wanted to reach a new domain would have to register it first, which is
   * itself a recorded act.
   *
   * ── Why it is rate-limited separately ───────────────────────────────
   * Every call here hits a real publisher's server, so this budget exists to
   * protect THEM, not us. A hundred an hour is what verifying a fifty-source
   * registry actually costs — several candidate paths per source, plus the
   * re-tests after a URL is corrected — and is still nowhere near enough to be
   * a nuisance to a regulator whose goodwill this project depends on. Spread
   * across fifty domains it is two requests each.
   *
   * Counted per ADMIN ACCOUNT rather than per IP. The note at the top of
   * lib/ratelimit.ts is about corporate NAT: an operator working from a firm's
   * gateway should not share a verification budget with everyone else behind
   * that address. Safe here because the admin check above has already run —
   * keying on identity before authenticating would key on something the caller
   * chooses, which is not a limit at all.
   */
  if (action === "test_source") {
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A source id is required" }, { status: 400 });
    }
    const source = await sourceById(id);
    if (!source) return NextResponse.json({ error: "No such source" }, { status: 404 });

    const throttled = await guard(req, "admin-newsroom-probe", 100, WINDOW.hour, user.email);
    if (throttled) return throttled;

    // Defaults to what is registered, so the common case is one click. A
    // candidate URL may be supplied to try a path before committing to it.
    const url = String(b.url ?? "").trim() || source.feed_url;
    if (!url) {
      return NextResponse.json(
        { error: "This source has no feed URL — enter one to test" },
        { status: 400 }
      );
    }
    if (!feedUrlBelongsTo(url, source.domain)) {
      return NextResponse.json(
        { error: `A test URL must be https and belong to ${source.domain}` },
        { status: 400 }
      );
    }

    const probe = await probeFeed(url, {
      hint: source.ingestion_method,
      domain: source.domain,
    });
    // Recorded before returning, so the trail of what was tried survives the
    // browser tab. Failures especially: they are what stops the next person
    // repeating a dead path.
    await recordProbe({ sourceId: id, url, actor: user.email, probe });

    return NextResponse.json({ ok: true, url, probe });
  }

  if (action === "create") {
    const check = validateSource({
      name: String(b.name ?? ""),
      domain: String(b.domain ?? ""),
      source_type: String(b.source_type ?? ""),
      authority_tier: Number(b.authority_tier),
      jurisdictions: Array.isArray(b.jurisdictions) ? b.jurisdictions.map(String) : [],
      topics: Array.isArray(b.topics) ? b.topics.map(String) : [],
      ingestion_method: String(b.ingestion_method ?? ""),
      feed_url: String(b.feed_url ?? ""),
      fetch_frequency: b.fetch_frequency === undefined ? undefined : Number(b.fetch_frequency),
      fetch_allowed: false,
      license_notes: String(b.license_notes ?? ""),
      snapshot_retention: b.snapshot_retention ? String(b.snapshot_retention) : undefined,
    });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    try {
      const id = await createSource(check.value);
      return NextResponse.json({ ok: true, id });
    } catch (e) {
      if (e instanceof Error && /UNIQUE/.test(e.message)) {
        return NextResponse.json({ error: "That domain is already registered" }, { status: 409 });
      }
      throw e;
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
