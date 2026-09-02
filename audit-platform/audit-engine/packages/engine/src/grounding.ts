import type {
  GroundingReport, GroundingState, IngestedSource, Groundable,
} from "@audit/domain";

/** What the validator inspects. `kind` only labels the failure for the report. */
export interface GroundableEntry {
  kind: string;
  obj: Groundable & Record<string, unknown>;
}

export interface GroundingOptions {
  /** Library ids that exist in the loaded pack; unknown refs are a failure. */
  knownRiskIds?: Set<string>;
  knownControlIds?: Set<string>;
  /** Ids of risks produced in this run, for checking Control.addressesRiskIds. */
  runRiskIds?: Set<string>;
}

/**
 * Deterministic. No model call, no network, no I/O.
 *
 * This is the component where a silent bug is invisible in the output, so it is written
 * to be read: every rule is a separate, named check (07 §7.4).
 */
export function normalise(text: string): string {
  // All punctuation is discarded rather than mapped, so that a smart quote, a straight
  // quote, an em dash and a hyphen can never cause a true citation to fail. Both sides of
  // every comparison go through this function, so the loss of punctuation is symmetric.
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function validateGrounding(
  entries: GroundableEntry[],
  src: IngestedSource,
  opts: GroundingOptions = {},
): GroundingReport {
  const needsSource: GroundingReport["needsSource"] = [];
  let integrityOk = true;
  const segById = new Map(src.segments.map((s) => [s.segmentId, s]));

  for (const { kind, obj } of entries) {
    const fail = (reason: GroundingReport["needsSource"][number]["reason"], detail: string | null) => {
      needsSource.push({ objectId: obj.id, kind, reason, detail });
    };

    // 1. every object carries at least one reference
    if (!obj.evidenceRefs || obj.evidenceRefs.length === 0) {
      fail("no_ref", null);
      obj.grounding = "needs_source";
      continue;
    }

    // 2. the object belongs to this engagement
    if (obj.engagementId !== src.engagementId) {
      fail("ref_outside_engagement", `object engagementId ${obj.engagementId}`);
      integrityOk = false;
      obj.grounding = "needs_source";
      continue;
    }

    let refsOk = true;
    for (const ref of obj.evidenceRefs) {
      // 3. the locator resolves inside this case
      if (ref.locator.kind !== "transcript") {
        fail("ref_unresolvable", `locator kind ${ref.locator.kind} not supported in Phase 0`);
        refsOk = false;
        continue;
      }
      const seg = segById.get(ref.locator.segmentId);
      if (!seg) {
        fail("ref_unresolvable", `unknown segment ${ref.locator.segmentId}`);
        integrityOk = false;
        refsOk = false;
        continue;
      }
      // 4. the quote actually occurs in the located text
      const hay = normalise(seg.text);
      const needle = normalise(ref.quote);
      if (needle.length === 0 || !hay.includes(needle)) {
        fail("quote_not_found", `segment ${ref.locator.segmentId}`);
        refsOk = false;
      }
    }

    // 5. library discipline
    const libraryRef = obj["libraryRef"] as string | null | undefined;
    if (libraryRef === null && kind === "risk" && !obj["newRiskJustification"]) {
      fail("missing_new_risk_justification", null);
      refsOk = false;
    }
    if (typeof libraryRef === "string") {
      const known = kind === "risk" ? opts.knownRiskIds : kind === "control" ? opts.knownControlIds : undefined;
      if (known && !known.has(libraryRef)) {
        fail("unknown_library_ref", libraryRef);
        refsOk = false;
      }
    }

    // 6. controls must point at risks produced in this run
    if (kind === "control" && opts.runRiskIds) {
      const links = (obj["addressesRiskIds"] as string[] | undefined) ?? [];
      for (const rid of links) {
        if (!opts.runRiskIds.has(rid)) {
          fail("dangling_risk_reference", rid);
          refsOk = false;
        }
      }
    }

    obj.grounding = (refsOk ? "grounded" : "needs_source") satisfies GroundingState;
  }

  // Counted from the state written above, not from what the caller passed in: an early
  // return that forgot to write the state would otherwise report an ungrounded object as
  // grounded. This is the exact class of silent defect this component exists to prevent.
  const grounded = entries.filter((e) => e.obj.grounding === "grounded").length;
  return { total: entries.length, grounded, needsSource, integrityOk };
}
