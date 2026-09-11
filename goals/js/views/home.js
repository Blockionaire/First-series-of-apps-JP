/* =====================================================================
   GOALS — Home
   =====================================================================
   The page that answers four questions before you have finished
   reading it: what am I working towards, am I on track, what does this
   week ask of me, and what am I learning. Then one tap to log.
   ===================================================================== */

import { state, activePeriod, goalsOf, standardsOf, currentTopic,
         entriesFor, loggableTypes } from "../store.js";
import { periodProgress, topicProgress } from "../progress.js";
import { goalCard, standardRow, periodLine } from "../cards.js";
import { openLog } from "../log.js";
import { editPeriod } from "../forms.js";
import { esc, on, todayISO, formatDate, formatSpan, weekStart, weekEnd, progressBar } from "../util.js";
import { activityType } from "../data/types.js";
import { icon } from "../icons.js";

export const title = () => "Home";

/* The quick actions, in the order a week actually happens. Anything
   the current period does not use simply is not offered. */
const QUICK = ["weight", "gym", "run", "hours", "bible", "study", "learning",
               "revenue", "repayment", "customer"];

export function html() {
  const period = activePeriod();
  if (!period) return welcome();

  const p = periodProgress(period);
  const goals = goalsOf(period.id);
  const topic = currentTopic();

  return `
    <div class="stack-xl" style="padding-top:4px">
      ${header(p)}
      ${quickRow()}
      ${goalsBlock(goals)}
      ${weekBlock(goals)}
      ${topic ? curiosityBlock(topic) : ""}
    </div>`;
}

/* ---------------------------------------------------------------
   The header
   --------------------------------------------------------------- */
function header(p) {
  const name = state.settings.name;
  return `
    <header>
      <p class="eyebrow">${esc(greeting(name))} · ${esc(formatDate(todayISO(), "day"))}</p>
      <h1 class="display" style="margin-top:12px">
        <a href="#/goals" style="text-decoration:none">${esc(p.period.title)}</a>
      </h1>
      <div style="margin-top:18px;max-width:420px">${periodLine(p)}</div>
    </header>`;
}

function greeting(name) {
  const hour = new Date().getHours();
  const part = hour < 6 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

/* ---------------------------------------------------------------
   Quick logging
   ---------------------------------------------------------------
   The whole point is that this takes seconds. One row, the types this
   period actually uses, and the sheet opens straight on the right form.
   --------------------------------------------------------------- */
function quickRow() {
  const available = loggableTypes().map(option => option.type);
  const ordered = QUICK.filter(type => available.includes(type));
  const rest = available.filter(type => !ordered.includes(type));

  return `
    <section aria-label="Quick logging">
      <div class="quick">
        ${ordered.concat(rest).slice(0, 7).map(type => {
          const definition = activityType(type);
          if (!definition) return "";
          return `<button class="quick__button" data-log="${esc(type)}">
                    ${icon("plus", { size: 14 })} ${esc(definition.label)}
                  </button>`;
        }).join("")}
        <button class="quick__button quick__button--more" data-log="">Something else</button>
      </div>
    </section>`;
}

/* ---------------------------------------------------------------
   The goals
   --------------------------------------------------------------- */
function goalsBlock(goals) {
  if (!goals.length) {
    return `
      <section>
        <div class="section-head"><h2 class="subtitle">Goals</h2></div>
        <div class="empty">
          <p class="empty__title">This period has no goals yet.</p>
          <p><a class="link" href="#/goals">Add the first one</a></p>
        </div>
      </section>`;
  }

  return `
    <section>
      <div class="section-head">
        <h2 class="subtitle">Goals</h2>
        <a class="link" href="#/goals">All goals</a>
      </div>
      <div class="goal-grid">${goals.map(goal => goalCard(goal)).join("")}</div>
    </section>`;
}

/* ---------------------------------------------------------------
   This week
   ---------------------------------------------------------------
   Standards only. Not a task list — the things you said you would keep
   doing, and how far along the week is.
   --------------------------------------------------------------- */
function weekBlock(goals) {
  const week = weekStart();
  const withStandards = goals
    .map(goal => ({ goal, standards: standardsOf(goal.id) }))
    .filter(row => row.standards.length);

  if (!withStandards.length) return "";

  const logged = entriesFor({ from: week, to: weekEnd(week) }).length;

  return `
    <section>
      <div class="section-head">
        <h2 class="subtitle">This week</h2>
        <a class="link" href="#/review/week/${week}">Review</a>
      </div>

      <p class="meta num" style="margin-bottom:20px">
        ${formatSpan(week, weekEnd(week))}${logged ? ` · ${logged} logged` : ""}
      </p>

      <div class="week">
        ${withStandards.map(row => `
          <div class="week__goal">
            <p class="eyebrow">${esc(row.goal.key || row.goal.title)}</p>
            <div class="standards">
              ${row.standards.map(standard => standardRow(standard, week, { compact: true })).join("")}
            </div>
          </div>`).join("")}
      </div>
    </section>`;
}

/* ---------------------------------------------------------------
   Curiosity
   --------------------------------------------------------------- */
function curiosityBlock(topic) {
  const t = topicProgress(topic);

  return `
    <section>
      <div class="section-head">
        <h2 class="subtitle">Currently learning</h2>
        <a class="link" href="#/curiosity">All topics</a>
      </div>

      <a class="learning" href="#/topic/${topic.id}">
        <div class="learning__cover topic__cover ${topic.cover ? "" : "topic__cover--tinted"}"
             style="--tint:${topic.tint || 30}">
          ${topic.cover
            ? `<img src="${esc(topic.cover)}" alt="">`
            : `<span class="topic__letter">${esc(topic.title.slice(0, 1))}</span>`}
        </div>

        <div class="learning__body">
          <p class="eyebrow">${esc(topic.month ? monthLabel(topic.month) : "Current")}</p>
          <h3 class="learning__title">${esc(topic.title)}</h3>
          <p class="meta num" style="margin-top:8px">${t.done} / ${t.total} modules completed</p>
          <div style="margin-top:10px;max-width:280px">${progressBar(t.fraction, { label: `${t.done} of ${t.total} modules` })}</div>
          ${t.next ? `<p class="learning__next"><span class="faint">Next</span> ${esc(t.next.title)}</p>` : ""}
          <span class="button button--small" style="margin-top:16px">Continue</span>
        </div>
      </a>
    </section>`;
}

const monthLabel = month => {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

/* ---------------------------------------------------------------
   Nothing yet
   --------------------------------------------------------------- */
function welcome() {
  return `
    <section class="stack-lg" style="padding-top:16vh;max-width:34em">
      <div>
        <p class="eyebrow">Goals</p>
        <h1 class="display" style="margin-top:12px">What are you working towards?</h1>
      </div>
      <p class="lead">Start with a period — a quarter, a summer, the rest of the year — and hang your
      goals on it. Everything else follows from that.</p>
      <div class="row">
        <button class="button button--solid" data-do="new-period">Create a goal period</button>
      </div>
    </section>`;
}

/* ---------------------------------------------------------------
   Behaviour
   --------------------------------------------------------------- */
export function mount(root) {
  on(root, "[data-log]", "click", (event, button) => {
    const type = button.dataset.log;
    openLog(type || null);
  });

  on(root, "[data-do]", "click", (event, button) => {
    if (button.dataset.do === "new-period") editPeriod(null);
  });
}
