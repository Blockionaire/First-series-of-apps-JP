/* =====================================================================
   GOALS — one goal
   =====================================================================
   Overview, milestones, activity, reflections. The overview answers
   "am I on track?" without scrolling; the other three tabs are where
   you go when the answer is "not sure".
   ===================================================================== */

import { byId, metricsOf, standardsOf, milestonesOf, entriesFor,
         notesOf, save } from "../store.js";
import { metricValue, goalProgress, durationMinutes, weeksIn } from "../progress.js";
import { chartSlot, paintCharts, ring } from "../charts.js";
import { swipeArea, swipeRows } from "../gestures.js";
import { standardRow } from "../cards.js";
import { editGoal, editMilestone, editMetric, editStandard, editNote, monthsBetween } from "../forms.js";
import { openLog, entryList, hookEntryList } from "../log.js";
import { esc, escLines, on, formatValue, formatDate, formatDuration, monthName,
         progressBar, todayISO, daysBetween, toast, weekStart, weekEnd,
         addDays, fromISO } from "../util.js";
import { icon } from "../icons.js";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "milestones", label: "Milestones" },
  { id: "activity", label: "Activity" },
  { id: "reflections", label: "Reflections" },
];

export const title = ([id]) => {
  const goal = byId("goals", id);
  return goal ? goal.title : "Goal";
};

export function html([id, tab = "overview"]) {
  const goal = byId("goals", id);
  if (!goal) {
    return `<div class="empty"><p class="empty__title">That goal is gone.</p>
      <a class="link" href="#/goals">Back to your goals</a></div>`;
  }

  const period = byId("periods", goal.periodId);

  return `
    <article class="stack-lg" style="padding-top:4px">
      <a class="back" href="#/goals">${icon("back", { size: 16 })} ${esc(period ? period.title : "Goals")}</a>

      <header>
        <p class="eyebrow">${esc(goal.key || "Goal")}</p>
        <h1 class="title" style="margin:12px 0 0;max-width:20ch">${esc(goal.title)}</h1>
        ${goal.objective ? `<p class="lead" style="margin-top:16px">${esc(goal.objective)}</p>` : ""}
      </header>

      <nav class="tabs">
        ${TABS.map(item => `
          <a class="tab ${tab === item.id ? "is-active" : ""}" href="#/goal/${goal.id}/${item.id}">${item.label}</a>`).join("")}
        <span class="tabs__marker" aria-hidden="true"></span>
      </nav>

      <div id="tab">${tabHtml(goal, tab)}</div>
    </article>`;
}

function tabHtml(goal, tab) {
  if (tab === "milestones") return milestonesTab(goal);
  if (tab === "activity") return activityTab(goal);
  if (tab === "reflections") return reflectionsTab(goal);
  return overviewTab(goal);
}

/* ---------------------------------------------------------------
   Overview
   --------------------------------------------------------------- */
function overviewTab(goal) {
  const p = goalProgress(goal);
  const metrics = metricsOf(goal.id);
  const standards = standardsOf(goal.id);
  const recent = entriesFor({ goalId: goal.id, limit: 5 });
  const left = goal.targetDate ? daysBetween(todayISO(), goal.targetDate) : null;

  return `
    <div class="stack-xl">
      ${goal.why ? `<p class="prose">${esc(goal.why)}</p>` : ""}

      ${goal.targetDate ? `
        <p class="meta num">Target date ${formatDate(goal.targetDate, "long")}${
          left !== null && left >= 0 ? ` · ${left} days left` : left !== null ? " · passed" : ""}</p>` : ""}

      <section>
        <div class="section-head">
          <h2 class="subtitle">Key metrics</h2>
          <button class="button button--small" data-do="new-metric">${icon("plus", { size: 14 })} Metric</button>
        </div>
        ${metrics.length ? `
          <div class="metric-grid">
            ${metrics.map(metric => metricBlock(metric)).join("")}
          </div>
          ${headlineChart(goal)}` : emptyBlock("Nothing is being measured yet.", "A metric turns your logs into one number you can watch.")}
      </section>

      <section>
        <div class="section-head">
          <h2 class="subtitle">Standards</h2>
          <button class="button button--small" data-do="new-standard">${icon("plus", { size: 14 })} Standard</button>
        </div>
        ${standards.length ? `
          <div class="standards">${standards.map(standard => standardRow(standard)).join("")}</div>
          <p class="meta" style="margin-top:12px">This week, Monday to Sunday.</p>`
        : emptyBlock("No weekly standard on this goal.", "Standards are the behaviour you keep up — the milestones are the outcomes.")}
      </section>

      <section>
        <div class="section-head">
          <h2 class="subtitle">Milestones</h2>
          <a class="link" href="#/goal/${goal.id}/milestones">All ${p.total || ""}</a>
        </div>
        ${p.total ? `
          <div class="week-head">
            ${ring(p.done / p.total, {
              size: 74,
              center: `${p.done}/${p.total}`,
              caption: "reached",
            })}
            <div class="week-head__text">
              ${p.next ? `
                <p class="week-head__line"><span class="faint">Next</span> <b>${esc(p.next.title)}</b></p>
                ${p.next.month ? `<p class="meta" style="margin-top:6px">${monthName(p.next.month)}</p>` : ""}`
              : `<p class="week-head__line">Every milestone on this goal is reached.</p>`}
            </div>
          </div>`
        : emptyBlock("No milestones yet.", "Outcomes to reach, usually one or two a month.")}
      </section>

      <section>
        <div class="section-head">
          <h2 class="subtitle">Recent activity</h2>
          <button class="button button--small" data-do="log">${icon("plus", { size: 14 })} Log</button>
        </div>
        ${entryList(recent, { empty: "Nothing logged for this goal yet." })}
        ${recent.length ? `<p style="margin-top:14px"><a class="link" href="#/goal/${goal.id}/activity">All activity</a></p>` : ""}
      </section>
    </div>`;
}

function metricBlock(metric) {
  const v = metricValue(metric);
  const decimals = metric.decimals ?? null;

  return `
    <div class="metric" data-metric="${metric.id}">
      <p class="eyebrow">${esc(metric.name)}</p>
      <p class="metric__value">${esc(formatValue(v.current, metric.unit, { decimals }))}</p>
      ${metric.target !== null ? `
        <p class="metric__target">
          ${metric.aggregation === "cumulative" || metric.aggregation === "count"
            ? `of ${esc(formatValue(metric.target, metric.unit))}`
            : `target ${esc(formatValue(metric.target, metric.unit))}`}
          ${v.remaining !== null && v.remaining > 0
            ? ` · ${esc(formatValue(v.remaining, metric.unit, { decimals }))} to go` : ""}
        </p>
        <div style="margin-top:10px">${progressBar(v.fraction, { label: `${metric.name}: ${Math.round((v.fraction || 0) * 100)}%` })}</div>`
        : `<p class="metric__target">${metricNote(metric, v)}</p>`}
    </div>`;
}

/* The goal's main reading, drawn properly: the line, its target as a
   threshold, and the last value labelled. Anything with fewer than two
   readings has no shape to show yet. */
function headlineChart(goal) {
  const metric = goalProgress(goal).metric;
  if (!metric) return "";
  const value = metricValue(metric);
  if (value.series.length < 2) return "";

  return `
    <figure class="figure">
      <figcaption class="figure__caption">${esc(metric.name)} over this period</figcaption>
      ${chartSlot("line", value.series, {
        unit: metric.unit,
        decimals: metric.decimals ?? "",
        target: metric.target === null ? "" : metric.target,
        height: 200,
        label: `${metric.name} over time`,
      })}
    </figure>`;
}

/* How much happened, week by week. The week you are in is picked out;
   the rest stay quiet. */
function weekBars(goal, period) {
  if (!period) return "";
  const today = todayISO();
  const weeks = weeksIn(period.start, period.end).filter(week => week <= today);
  if (weeks.length < 2) return "";

  const thisWeek = weekStart(today);
  const data = weeks.map(week => ({
    label: formatDate(week, "short"),
    value: entriesFor({ goalId: goal.id, from: week, to: weekEnd(week) }).length,
    current: week === thisWeek,
  }));

  if (!data.some(week => week.value)) return "";

  return `
    <figure class="figure">
      <figcaption class="figure__caption">Logs per week</figcaption>
      ${chartSlot("bars", data, { unit: "count", height: 150, label: "Logs per week" })}
    </figure>`;
}

/* Which days you actually showed up. */
function calendar(goal, period) {
  if (!period) return "";
  const today = todayISO();
  const from = weekStart(period.start);
  const to = period.end < today ? period.end : today;
  if (from >= to) return "";

  const counts = new Map();
  for (const entry of entriesFor({ goalId: goal.id, from, to })) {
    counts.set(entry.date, (counts.get(entry.date) || 0) + 1);
  }
  if (!counts.size) return "";

  const days = [];
  let cursor = from, column = 1;
  while (cursor <= to) {
    days.push({ date: cursor, count: counts.get(cursor) || 0, column });
    if (fromISO(cursor).getDay() === 0) column += 1;   // Sunday closes the column
    cursor = addDays(cursor, 1);
  }

  return `
    <figure class="figure">
      <figcaption class="figure__caption">Days logged</figcaption>
      ${chartSlot("calendar", days, { label: "Days logged" })}
    </figure>`;
}

/* What to say under a figure that has no target: how it was arrived at,
   or when it was last touched. */
function metricNote(metric, value) {
  if (!value.lastDate) return "nothing logged yet";
  if (metric.aggregation === "pace") {
    return `over ${value.samples} ${value.samples === 1 ? "run" : "runs"} · last ${formatDate(value.lastDate, "short")}`;
  }
  return `last ${formatDate(value.lastDate, "short")}`;
}

/* ---------------------------------------------------------------
   Milestones
   --------------------------------------------------------------- */
function milestonesTab(goal) {
  const milestones = milestonesOf(goal.id);
  const period = byId("periods", goal.periodId);
  const months = period ? monthsBetween(period.start, period.end) : [];
  const extra = milestones.filter(m => !m.month || !months.includes(m.month));

  const groups = months.map(month => ({
    month,
    items: milestones.filter(m => m.month === month),
  }));

  if (extra.length) groups.push({ month: null, items: extra });

  return `
    <div class="months">
      ${groups.map(group => {
        const done = group.items.filter(m => m.done).length;
        return `
          <section>
            <div class="month__head">
              <h2 class="subtitle">${group.month ? monthName(group.month) : "No month"}</h2>
              <span class="meta num">${group.items.length ? `${done} / ${group.items.length}` : ""}</span>
            </div>
            ${group.items.map(milestone => `
              <div class="milestone ${milestone.done ? "is-done" : ""}">
                <input class="checkbox" type="checkbox" data-tick="${milestone.id}"
                       ${milestone.done ? "checked" : ""}
                       aria-label="${esc(milestone.title)}">
                <span class="milestone__text">${esc(milestone.title)}</span>
                <button class="icon-button" data-edit-milestone="${milestone.id}" aria-label="Edit">${icon("edit", { size: 16 })}</button>
              </div>`).join("")}
            <button class="link" style="margin-top:14px" data-new-milestone="${group.month || ""}">
              Add to ${group.month ? monthName(group.month).split(" ")[0] : "this goal"}
            </button>
          </section>`;
      }).join("")}
      ${!groups.length ? emptyBlock("No milestones yet.", "Add the outcomes you want to reach.") : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   Activity
   --------------------------------------------------------------- */
function activityTab(goal) {
  const entries = entriesFor({ goalId: goal.id });
  const minutes = entries.reduce((sum, entry) => sum + durationMinutes(entry), 0);
  const period = byId("periods", goal.periodId);

  return `
    <div class="stack-xl">
      ${entries.length ? `
        <section>
          ${weekBars(goal, period)}
          ${calendar(goal, period)}
        </section>` : ""}

      <section>
        <div class="section-head">
          <h2 class="subtitle">${entries.length} ${entries.length === 1 ? "log" : "logs"}</h2>
          <button class="button button--small" data-do="log">${icon("plus", { size: 14 })} Log</button>
        </div>
        ${minutes ? `<p class="meta num" style="margin-bottom:16px">${formatDuration(minutes)} recorded in total</p>` : ""}
        ${entryList(entries, { empty: "Nothing logged for this goal yet.", swipe: true })}
        ${entries.length ? `<p class="meta" style="margin-top:14px">Swipe a log to delete it, or tap to change it.</p>` : ""}
      </section>
    </div>`;
}

/* ---------------------------------------------------------------
   Reflections
   ---------------------------------------------------------------
   Notes you wrote on the goal, plus the reflections attached to study
   sessions. Same page, because when you look back you do not care
   which screen you typed them on.
   --------------------------------------------------------------- */
function reflectionsTab(goal) {
  const notes = notesOf("goal", goal.id);
  const reflections = entriesFor({ goalId: goal.id }).filter(entry => entry.reflection);

  return `
    <div class="stack-xl">
      <section>
        <div class="section-head">
          <h2 class="subtitle">Notes</h2>
          <button class="link" data-do="new-note">Add note</button>
        </div>
        ${notes.length ? notes.map(note => `
          <article class="note" data-note="${note.id}">
            <div class="row row--between">
              <h3 class="note__title">${esc(note.title || formatDate(note.date, "long"))}</h3>
              <span class="meta num">${formatDate(note.date, "short")}</span>
            </div>
            <p class="note__text">${escLines(note.text)}</p>
          </article>`).join("")
        : emptyBlock("No notes yet.", "Anything worth remembering that is not a number.")}
      </section>

      <section>
        <div class="section-head"><h2 class="subtitle">From your study sessions</h2></div>
        ${reflections.length ? reflections.map(entry => `
          <article class="note">
            <div class="row row--between">
              <h3 class="note__title">${esc(formatDate(entry.date, "long"))}</h3>
              ${entry.note ? `<span class="meta">${esc(entry.note)}</span>` : ""}
            </div>
            ${Object.entries(entry.reflection || {}).filter(([, text]) => text && text.trim()).map(([key, text]) => `
              <p class="note__prompt">${esc(promptLabel(key))}</p>
              <p class="note__text">${escLines(text)}</p>`).join("")}
          </article>`).join("")
        : emptyBlock("No reflections yet.", "They appear here when you answer the prompts after a study session.")}
      </section>
    </div>`;
}

const PROMPTS = {
  god: "What have I learned about God?",
  bible: "What have I learned about the Bible?",
  prayer: "What has changed in my prayer?",
  questions: "What questions do I have?",
};

const promptLabel = key => PROMPTS[key] || key;

function emptyBlock(title, line) {
  return `<div class="empty"><p class="empty__title">${esc(title)}</p><p>${esc(line)}</p></div>`;
}

/* ---------------------------------------------------------------
   Behaviour
   --------------------------------------------------------------- */
export function mount(root, [id, tab = "overview"]) {
  const goal = byId("goals", id);
  if (!goal) return;

  const stopCharts = paintCharts(root);
  hookEntryList(root);
  swipeRows(root);
  slideMarker(root);

  /* The four tabs are also a swipe apart. */
  const index = TABS.findIndex(item => item.id === tab);
  const stopSwipe = swipeArea(root, {
    onLeft:  () => { if (index < TABS.length - 1) location.hash = `#/goal/${goal.id}/${TABS[index + 1].id}`; },
    onRight: () => { if (index > 0) location.hash = `#/goal/${goal.id}/${TABS[index - 1].id}`; },
  });

  on(root, "[data-do]", "click", (event, button) => {
    const action = button.dataset.do;
    if (action === "log") openLog(null);
    if (action === "new-metric") editMetric(null, goal.id);
    if (action === "new-standard") editStandard(null, goal.id);
    if (action === "new-note") editNote(null, { level: "goal", refId: goal.id, title: goal.title });
    if (action === "edit-goal") editGoal(goal);
  });

  on(root, "[data-metric]", "dblclick", (event, block) => editMetric(byId("metrics", block.dataset.metric)));
  on(root, "[data-edit-milestone]", "click", (event, button) =>
    editMilestone(byId("milestones", button.dataset.editMilestone)));
  on(root, "[data-new-milestone]", "click", (event, button) =>
    editMilestone(null, goal.id, button.dataset.newMilestone || null));
  on(root, "[data-note]", "click", (event, article) =>
    editNote(byId("notes", article.dataset.note), { level: "goal", refId: goal.id, title: goal.title }));

  /* Ticking a milestone is the one change that should feel instant. */
  on(root, "[data-tick]", "change", async (event, box) => {
    const milestone = byId("milestones", box.dataset.tick);
    if (!milestone) return;
    await save("milestones", {
      ...milestone,
      done: box.checked,
      doneAt: box.checked ? todayISO() : null,
    });
    if (box.checked) toast("Milestone reached.");
  });

  return () => {
    if (stopCharts) stopCharts();
    if (stopSwipe) stopSwipe();
  };
}

/* The underline travels to the tab you picked rather than jumping. */
function slideMarker(root) {
  const marker = root.querySelector(".tabs__marker");
  const active = root.querySelector(".tab.is-active");
  if (!marker || !active) return;
  requestAnimationFrame(() => {
    marker.style.width = `${active.offsetWidth}px`;
    marker.style.transform = `translateX(${active.offsetLeft}px)`;
  });
}
