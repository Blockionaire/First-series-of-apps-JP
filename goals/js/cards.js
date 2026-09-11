/* =====================================================================
   GOALS — shared pieces
   =====================================================================
   The goal card and the weekly standard row appear on Home and on the
   goal pages. They live here so the two never drift apart.
   ===================================================================== */

import { esc, formatValue, progressBar, formatDate } from "./util.js";
import { goalProgress, standardWeek } from "./progress.js";
import { activityType } from "./data/types.js";

/* HEALTH
   Build a noticeably stronger and fitter body
   63.8 kg → 67 kg
   Next: 65 kg by end of October                                   */
export function goalCard(goal) {
  const p = goalProgress(goal);
  const metric = p.metric;
  const value = p.value;

  /* A reading reads as a journey (63.8 kg → 67 kg); a total reads as a
     fraction (€2,400 / €7,500). */
  const running = metric && (metric.aggregation === "cumulative" || metric.aggregation === "count");
  const decimals = metric ? metric.decimals ?? null : null;

  const figures = metric && value
    ? `<div class="goal-card__figures num">
         <span>${esc(formatValue(value.current, metric.unit, { decimals }))}</span>
         ${metric.target !== null ? `
           <span class="goal-card__arrow" aria-hidden="true">${running ? "/" : "→"}</span>
           <span class="goal-card__target">${esc(formatValue(metric.target, metric.unit))}</span>` : ""}
         ${countable(metric) ? `<span class="goal-card__unit">${esc(metric.name.toLowerCase())}</span>` : ""}
       </div>`
    : `<div class="goal-card__figures faint">Nothing measured yet</div>`;

  return `
    <a class="goal-card" href="#/goal/${goal.id}">
      <p class="eyebrow">${esc(goal.key || "Goal")}</p>
      <h3 class="goal-card__title">${esc(goal.title)}</h3>
      ${figures}
      ${value && value.fraction !== null
        ? `<div style="margin-top:14px">${progressBar(value.fraction, { label: `${Math.round(value.fraction * 100)}% of ${metric.name}` })}</div>`
        : ""}
      ${cardFooter(p)}
    </a>`;
}

/* "0 → 85" says nothing; "0 / 85 reading sessions" does. */
const countable = metric => ["count", "sessions"].includes(metric.unit);

/* Under the numbers: the next milestone, or — for a goal that is all
   rhythm and no milestones — how this week is going. */
function cardFooter(p) {
  if (p.next) {
    return `<p class="goal-card__next"><span class="faint">Next</span> <b>${esc(p.next.title)}</b></p>`;
  }
  if (p.total) {
    return `<p class="goal-card__next"><span class="faint">All ${p.total} milestones reached</span></p>`;
  }
  const week = p.standards[0];
  if (week) {
    return `<p class="goal-card__next"><span class="faint">This week</span>
      <b>${esc(week.standard.title)} ${formatCount(week.done, week.standard.unit)} / ${formatCount(week.target, week.standard.unit)}</b></p>`;
  }
  return "";
}

/* Gym  ●●●○○○○  3 / 4 */
export function standardRow(standard, week, { compact = false } = {}) {
  const s = standardWeek(standard, week);
  const definition = activityType(standard.type);

  const count = s.standard.unit === "tags"
    ? (s.detail || []).map(tag =>
        `<span class="tick tick--${tag.done ? "yes" : "no"}">${esc(label(definition, tag.tag))} ${tag.done ? "✓" : "✕"}</span>`).join(" ")
    : `<b>${formatCount(s.done, s.standard.unit)}</b> / ${formatCount(targetLabel(s.standard), s.standard.unit)}`;

  return `
    <div class="standard ${s.met ? "is-met" : ""}">
      <div class="standard__label">
        <div class="standard__name">${esc(standard.title)}</div>
        ${standard.note && !compact ? `<div class="standard__note">${esc(standard.note)}</div>` : ""}
      </div>
      <div class="standard__count">${count}</div>
    </div>`;
}

function label(definition, tagId) {
  if (!definition || !definition.tags) return tagId;
  const tag = definition.tags.find(t => t.id === tagId);
  return tag ? tag.label : tagId;
}

function targetLabel(standard) {
  if (standard.max && standard.max !== standard.min) return `${standard.min}–${standard.max}`;
  return standard.min;
}

function formatCount(value, unit) {
  if (typeof value !== "number") return value;
  const rounded = Math.round(value * 10) / 10;
  return unit === "hours" ? `${rounded}h` : String(rounded);
}

/* The line under the period title: how much of it is gone. */
export function periodLine(p) {
  if (!p) return "";
  if (!p.started) return `<p class="meta num">Starts ${formatDate(p.period.start, "long")}</p>`;
  if (p.ended) return `<p class="meta num">Ended ${formatDate(p.period.end, "long")}</p>`;
  return `
    <div class="period-line">
      <p class="meta num">${p.left} days left · ${p.weeksLeft} weeks</p>
      <div style="margin-top:8px">${progressBar(p.fraction, { tone: "time", label: `${Math.round(p.fraction * 100)}% of the period gone` })}</div>
    </div>`;
}
