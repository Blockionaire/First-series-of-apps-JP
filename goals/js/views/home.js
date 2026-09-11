/* =====================================================================
   GOALS — Home (foundation version)
   =====================================================================
   Phase 1 only proves the plumbing: the period is there, the goals are
   there, the seed landed. The real dashboard arrives in phase 3.
   ===================================================================== */

import { state, activePeriod, goalsOf } from "../store.js";
import { esc, formatRange } from "../util.js";

export const title = () => "Home";

export function html() {
  const period = activePeriod();
  if (!period) {
    return `<div class="empty"><p class="empty__title">No goal period yet.</p></div>`;
  }

  const goals = goalsOf(period.id);

  return `
    <section class="stack-lg" style="padding-top:20px">
      <div>
        <p class="eyebrow">Current period</p>
        <h1 class="display" style="margin-top:10px">${esc(period.title)}</h1>
        <p class="lead" style="margin-top:14px">${esc(period.description || "")}</p>
        <p class="meta num" style="margin-top:10px">${formatRange(period.start, period.end)}</p>
      </div>

      <div class="list">
        ${goals.map(goal => `
          <a class="list__item" href="#/goal/${goal.id}">
            <span class="list__main">
              <span class="list__title">${esc(goal.title)}</span>
              <span class="list__sub">${esc(goal.key)}</span>
            </span>
            <span class="list__chevron" aria-hidden="true">→</span>
          </a>`).join("")}
      </div>

      <p class="meta">${state.entries.length} entries logged.</p>
    </section>`;
}
