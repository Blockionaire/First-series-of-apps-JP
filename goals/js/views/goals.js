/* =====================================================================
   GOALS — the goals of a period
   =====================================================================
   The period you are in, what it holds, and how much of it is left.
   Other periods sit underneath, so last quarter is one tap away and
   next year can be planned before it starts.
   ===================================================================== */

import { state, activePeriod, goalsOf, saveSettings } from "../store.js";
import { periodProgress } from "../progress.js";
import { goalCard, periodLine } from "../cards.js";
import { editPeriod, editGoal } from "../forms.js";
import { esc, on, formatRange, formatDate } from "../util.js";
import { icon } from "../icons.js";

export const title = () => "Goals";

export function html() {
  const period = activePeriod();

  if (!period) {
    return `
      <section style="padding-top:20px">
        <div class="empty">
          <p class="empty__title">No goal period yet.</p>
          <p>A period is a stretch of months you are working towards — a quarter, a summer, the rest of the year.</p>
        </div>
        <button class="button button--solid" data-do="new-period">Create the first one</button>
      </section>`;
  }

  const p = periodProgress(period);
  const goals = goalsOf(period.id);
  const others = state.periods.filter(other => other.id !== period.id);

  return `
    <section class="stack-xl" style="padding-top:8px">
      <header>
        <div class="row row--between">
          <p class="eyebrow">Goal period</p>
          <button class="link" data-do="edit-period">Edit</button>
        </div>
        <h1 class="display" style="margin-top:12px">${esc(period.title)}</h1>
        <p class="meta num" style="margin-top:12px">${formatRange(period.start, period.end)}</p>
        ${period.description ? `<p class="lead" style="margin-top:16px">${esc(period.description)}</p>` : ""}
        <div style="margin-top:20px;max-width:420px">${periodLine(p)}</div>
      </header>

      ${goals.length ? `
        <h2 class="visually-hidden">Goals in this period</h2>
        <div class="goal-grid">
          ${goals.map(goal => goalCard(goal)).join("")}
        </div>` : `
        <div class="empty">
          <p class="empty__title">This period has no goals yet.</p>
          <p>Four is usually plenty.</p>
        </div>`}

      <div class="row">
        <button class="button" data-do="new-goal">${icon("plus", { size: 16 })} Add a goal</button>
      </div>

      ${others.length ? `
        <div>
          <div class="section-head">
            <h2 class="subtitle">Other periods</h2>
            <button class="link" data-do="new-period">New period</button>
          </div>
          <div class="list">
            ${others.map(other => `
              <button class="list__item" data-period="${other.id}">
                <span class="list__main">
                  <span class="list__title">${esc(other.title)}</span>
                  <span class="list__sub num">${formatDate(other.start, "short")} – ${formatDate(other.end, "long")} ·
                    ${goalsOf(other.id).length} goals</span>
                </span>
                <span class="list__side">${esc(other.status || "")}</span>
              </button>`).join("")}
          </div>
        </div>` : `
        <div class="row">
          <button class="link" data-do="new-period">Add another period</button>
        </div>`}
    </section>`;
}

export function mount(root) {
  const period = activePeriod();

  on(root, "[data-do]", "click", (event, button) => {
    const action = button.dataset.do;
    if (action === "edit-period") editPeriod(period);
    if (action === "new-period") editPeriod(null);
    if (action === "new-goal") editGoal(null, period ? period.id : null);
  });

  /* Switching periods is just a setting — the goals follow. */
  on(root, "[data-period]", "click", async (event, button) => {
    await saveSettings({ periodId: button.dataset.period });
    window.scrollTo({ top: 0 });
  });
}
