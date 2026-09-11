/* =====================================================================
   GOALS — reviews
   =====================================================================
   Every week and every month of the current period, with the ones you
   have already written up marked. Short on purpose: a review you dread
   is a review you skip.
   ===================================================================== */

import { state, activePeriod } from "../store.js";
import { pastWeeks, pastMonths, weekSummary, monthSummary } from "../progress.js";
import { esc, formatSpan, monthName, weekStart, weekEnd, todayISO, monthOf } from "../util.js";

export const title = () => "Reviews";

export function html() {
  const period = activePeriod();
  if (!period) {
    return `<div class="empty"><p class="empty__title">Reviews follow a goal period.</p>
      <p><a class="link" href="#/goals">Create one first</a></p></div>`;
  }

  const weeks = pastWeeks(period, 14);
  const thisWeek = weekStart();
  const months = pastMonths(period).filter(month => month <= monthOf(todayISO()));

  return `
    <section class="stack-xl" style="padding-top:8px">
      <header>
        <p class="eyebrow">Reviews</p>
        <h1 class="title" style="margin-top:10px">Looking back</h1>
        <p class="lead" style="margin-top:14px">A short review every Sunday and one at the end of each
        month. The numbers fill themselves in; you only answer the questions.</p>
      </header>

      <section>
        <div class="section-head"><h2 class="subtitle">Weeks</h2></div>
        <div class="list">
          ${weeks.map(week => weekRow(week, week === thisWeek)).join("")}
        </div>
      </section>

      <section>
        <div class="section-head"><h2 class="subtitle">Months</h2></div>
        <div class="list">
          ${months.map(month => monthRow(month)).join("")}
        </div>
      </section>
    </section>`;
}

function weekRow(week, isCurrent) {
  const summary = weekSummary(week);
  const saved = state.weekly.find(review => review.weekStart === week);

  return `
    <a class="list__item" href="#/review/week/${week}">
      <span class="list__main">
        <span class="list__title">${esc(formatSpan(week, weekEnd(week)))}${isCurrent ? ` <span class="faint">· this week</span>` : ""}</span>
        <span class="list__sub num">${summary.standards ? `${summary.met} of ${summary.standards} standards met` : "no standards yet"}
          ${summary.entries.length ? ` · ${summary.entries.length} logged` : ""}</span>
      </span>
      <span class="list__side">${saved ? "Reviewed" : ""}</span>
    </a>`;
}

function monthRow(month) {
  const summary = monthSummary(month);
  const saved = state.monthly.find(review => review.month === month);
  const milestones = summary.perGoal.reduce((sum, row) => sum + row.milestones.length, 0);
  const hit = summary.perGoal.reduce((sum, row) => sum + row.hit, 0);

  return `
    <a class="list__item" href="#/review/month/${month}">
      <span class="list__main">
        <span class="list__title">${esc(monthName(month))}</span>
        <span class="list__sub num">${milestones ? `${hit} of ${milestones} milestones reached` : "no milestones"}
          ${summary.entries.length ? ` · ${summary.entries.length} logged` : ""}</span>
      </span>
      <span class="list__side">${saved ? "Reviewed" : ""}</span>
    </a>`;
}
