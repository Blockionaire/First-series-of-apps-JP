/**
 * Spend control.
 *
 * This module exists in phase 1, before a single model call, and that is the
 * whole point of change C1 in the masterplan. The original plan put budgets in
 * phase 5, after phase 4 had already been running a generation pipeline for
 * weeks. A budget that arrives in phase 5 arrives after the bill.
 *
 * ── The ceiling ──────────────────────────────────────────────────────────
 * €100 a month. Raised from €75 on 21 September 2026, and the reason is worth
 * stating because the number is easy to misread: THIS IS A CEILING, NOT A
 * BUDGET TO SPEND. Expected spend is unchanged at roughly €63 a month, and
 * pacing comes from the research cap — a count — not from the money.
 *
 * At €75 the two jobs collided. The throttle divides the month's remaining
 * budget by the expected cost of a story, and €75 across 22 working days at
 * ~40 cents a story yields exactly 8 — the target. So €75 supported the
 * intended volume only if the cost estimate was exactly right, and any
 * underestimate would silently throttle the desk to five or six stories a day.
 * That failure looks like "the engine isn't finding much", not like "we hit
 * the budget", which is the worst kind: it misdirects the diagnosis.
 *
 * €100 tolerates a story costing up to ~57 cents — a 42% underestimate —
 * before the throttle touches the target volume, against 42.5 cents and 6% at
 * €75. It still stops a runaway inside one month's damage.
 * Revisit once newsroom_ai_spend holds real numbers — cost/story from the
 * ledger beats any estimate in this file.
 *
 * ── Degrade, never fail ──────────────────────────────────────────────────
 * When spend runs ahead, the engine researches fewer stories. It does not skip
 * verification, shorten evidence packs or drop to a cheaper writer, because
 * every one of those trades quality for volume — and volume is the thing this
 * desk is willing to lose. A day that produces two well-evidenced pieces
 * instead of five is a good day. A day that produces five unverified ones is
 * the failure the whole pipeline is built to prevent.
 *
 * Phase 1 ships the arithmetic and the decision function. Nothing records
 * spend yet, because nothing spends yet.
 */

/** Cents throughout. Floating-point euros in a budget is how money goes missing. */
export type Cents = number;

export const MONTHLY_CAP_CENTS: Cents = 10000;

/**
 * Working days per month, for deriving a daily allowance.
 *
 * 22 rather than 30: the desk runs on weekdays, and dividing by calendar days
 * would set a daily cap the engine underspends five days a week and then
 * breaches on the sixth.
 */
export const WORKING_DAYS_PER_MONTH = 22;

/**
 * Stages, and what each may cost per story.
 *
 * These are ceilings, not estimates — a stage that wants more than this has
 * misunderstood its job, and the right response is to stop it rather than to
 * let it run. Derived from the masterplan §16 model with roughly 2× headroom,
 * so ordinary variation does not trip them.
 */
export const STAGE_CEILINGS: Record<PipelineStage, Cents> = {
  relevance: 2,
  research: 40,
  writing: 40,
  verification: 20,
  editorial: 12,
};

export const PIPELINE_STAGES = [
  "relevance",
  "research",
  "writing",
  "verification",
  "editorial",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export function isPipelineStage(v: string): v is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(v);
}

/** Absolute ceiling on what one story may cost end to end. */
export const STORY_CEILING_CENTS: Cents = Object.values(STAGE_CEILINGS).reduce((a, b) => a + b, 0);

/**
 * What a researched story is EXPECTED to cost, all in.
 *
 * Distinct from `STORY_CEILING_CENTS`, and the distinction is load-bearing.
 * The ceilings above are circuit breakers: they exist to stop one runaway
 * call or one retry loop, so they carry roughly 2× headroom and are never
 * expected to be reached. This number is the planning figure — what a story
 * actually costs on an ordinary day.
 *
 * Planning against the ceiling was the first version of this module and it
 * was wrong in a way that would have been invisible in production: dividing
 * the daily budget by the worst case meant the engine throttled itself to two
 * stories a day with a completely untouched budget. The configured cap would
 * effectively never have applied, and the only symptom would have been a desk
 * that quietly did a quarter of the work it was configured for.
 *
 * Derived from masterplan §16: ≈$3.10 a day across 8 researched stories,
 * including each story's share of the ~80 relevance classifications and the
 * five drafts that get written, verified and edited. Rounded up.
 *
 * This is a starting estimate, and it is meant to be replaced by measurement:
 * once `newsroom_ai_spend` has real rows, cost/story comes from the ledger.
 */
export const EXPECTED_STORY_COST_CENTS: Cents = 40;

/** Daily allowance derived from the monthly cap. */
export function dailyCapCents(monthlyCap: Cents = MONTHLY_CAP_CENTS): Cents {
  return Math.floor(monthlyCap / WORKING_DAYS_PER_MONTH);
}

/**
 * How many stories may be researched today.
 *
 * This is the throttle. The research cap is a *count*, not a spend threshold,
 * because a threshold makes throughput a function of the news cycle rather
 * than of the budget — see masterplan §7, change C2.
 *
 * The count shrinks as the month's remaining budget shrinks, so a heavy first
 * week does not mean an idle last week: the engine keeps working at a reduced
 * rate rather than stopping dead on the 24th.
 */
export function researchCapToday(input: {
  /** What the configured cap would be with budget to spare. */
  configuredCap: number;
  /** Spent this calendar month so far. */
  monthSpentCents: Cents;
  /** Working days left in the month, including today. */
  workingDaysLeft: number;
  monthlyCapCents?: Cents;
}): { cap: number; reason: string } {
  const monthlyCap = input.monthlyCapCents ?? MONTHLY_CAP_CENTS;
  const remaining = monthlyCap - input.monthSpentCents;

  if (remaining <= 0) {
    return { cap: 0, reason: "monthly budget exhausted — no research until the next period" };
  }
  if (input.workingDaysLeft <= 0) {
    return { cap: 0, reason: "no working days left in the period" };
  }

  // What today can afford if the rest of the month is to get an equal share.
  // Divided by the EXPECTED cost, not the ceiling — see the note on
  // EXPECTED_STORY_COST_CENTS. A stage that runs away is caught by maySpend;
  // planning around that possibility would throttle every ordinary day.
  const perDay = Math.floor(remaining / input.workingDaysLeft);
  const affordable = Math.floor(perDay / EXPECTED_STORY_COST_CENTS);

  if (affordable >= input.configuredCap) {
    return { cap: input.configuredCap, reason: "within budget" };
  }
  if (affordable <= 0) {
    return {
      cap: 0,
      reason: `remaining budget (€${(remaining / 100).toFixed(2)}) cannot cover a story at today's share`,
    };
  }
  return {
    cap: affordable,
    reason: `throttled from ${input.configuredCap} to ${affordable} to stay inside the monthly cap`,
  };
}

export type SpendVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * May this stage run for this story?
 *
 * Checked before the call, not after, and it answers three separate questions
 * in the order that matters: has the month run out, has this story already
 * cost more than a story may, and would this stage exceed its own ceiling.
 *
 * Phase 1 has no callers. It has tests.
 */
export function maySpend(input: {
  stage: PipelineStage;
  /** Estimated cost of the call about to be made. */
  estimateCents: Cents;
  /** Already spent on this story across all stages. */
  storySpentCents: Cents;
  /** Already spent on this stage for this story — retries accumulate. */
  stageSpentCents: Cents;
  monthSpentCents: Cents;
  monthlyCapCents?: Cents;
}): SpendVerdict {
  const monthlyCap = input.monthlyCapCents ?? MONTHLY_CAP_CENTS;

  if (input.monthSpentCents + input.estimateCents > monthlyCap) {
    return {
      allowed: false,
      reason: `monthly cap €${(monthlyCap / 100).toFixed(2)} would be exceeded`,
    };
  }
  if (input.storySpentCents + input.estimateCents > STORY_CEILING_CENTS) {
    return {
      allowed: false,
      reason: `story ceiling €${(STORY_CEILING_CENTS / 100).toFixed(2)} would be exceeded`,
    };
  }
  const stageCeiling = STAGE_CEILINGS[input.stage];
  if (input.stageSpentCents + input.estimateCents > stageCeiling) {
    // Almost always a retry loop rather than one expensive call. Stopping here
    // is what turns "a stage is looping" into a visible failed story rather
    // than into a surprise on the invoice.
    return {
      allowed: false,
      reason: `${input.stage} ceiling €${(stageCeiling / 100).toFixed(2)} would be exceeded`,
    };
  }
  return { allowed: true };
}

/**
 * Cost of a model call, in cents.
 *
 * Prices are per million tokens and belong in config, not here — this is the
 * arithmetic only, so that the one place cost is computed is the one place it
 * is tested. Cached input is billed at roughly a tenth of the input rate,
 * which is the largest single lever available at this ceiling: the style
 * guide, the source registry and the evidence pack are all stable prefixes
 * shared by the writer, the extractor and the editor.
 */
export function callCostCents(input: {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  /** Dollars per million tokens. */
  inputPerMillion: number;
  outputPerMillion: number;
  /** Multiplier applied to cached input. Anthropic bills cache reads at ~0.1×. */
  cacheReadMultiplier?: number;
  /** Batch submissions are billed at half. */
  batch?: boolean;
}): Cents {
  const cacheMultiplier = input.cacheReadMultiplier ?? 0.1;
  const cached = input.cachedInputTokens ?? 0;
  const fresh = Math.max(0, input.inputTokens - cached);

  const dollars =
    (fresh / 1_000_000) * input.inputPerMillion +
    (cached / 1_000_000) * input.inputPerMillion * cacheMultiplier +
    (input.outputTokens / 1_000_000) * input.outputPerMillion;

  const discounted = input.batch ? dollars / 2 : dollars;

  // Rounded up: a budget that rounds spend down drifts over, slowly, in the
  // direction nobody wants.
  //
  // `toPrecision` first, because ceiling a raw float overcharges. 100k tokens
  // at $2/M plus 10k at $10/M is exactly $0.30, but in binary floating point
  // it is 0.30000000000000004 — and Math.ceil turns that into 31 cents. Half
  // a million calls later that is a cent of phantom spend each, throttling the
  // desk against money it never spent.
  return Math.ceil(Number((discounted * 100).toPrecision(12)));
}

/** Working days (Mon–Fri) remaining in the month containing `date`, including it. */
export function workingDaysLeftInMonth(date = new Date()): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let count = 0;
  for (let d = date.getUTCDate(); d <= lastDay; d++) {
    const day = new Date(Date.UTC(year, month, d)).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export const euros = (c: Cents): string => `€${(c / 100).toFixed(2)}`;
