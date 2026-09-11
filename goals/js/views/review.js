/* =====================================================================
   GOALS — one review
   =====================================================================
   The numbers are already there: standards met, hours logged, learning
   time, milestones reached, metrics moved. You answer three questions
   and it is saved.

   Answers are kept; the figures above them are recalculated every time
   you open it, so correcting an old log corrects the review too.
   ===================================================================== */

import { state, save, activePeriod } from "../store.js";
import { weekSummary, monthSummary } from "../progress.js";
import { $$, esc, on, formatSpan, formatDate, formatDuration, formatValue,
         monthName, weekStart, weekEnd, toast, todayISO, monthOf } from "../util.js";
import { activityType } from "../data/types.js";
import { entryList, hookEntryList } from "../log.js";
import { icon } from "../icons.js";

const WEEK_QUESTIONS = [
  { id: "well", prompt: "What went well?" },
  { id: "improve", prompt: "What needs improvement?" },
  { id: "next", prompt: "What matters next week?" },
];

const MONTH_QUESTIONS = [
  { id: "worked", prompt: "What worked?" },
  { id: "failed", prompt: "What did not work?" },
  { id: "change", prompt: "What should change next month?" },
];

export const title = ([kind, key]) =>
  kind === "month" ? `${monthName(key)} review` : "Weekly review";

export function html([kind = "week", key = weekStart()]) {
  return kind === "month" ? monthReview(key) : weekReview(key);
}

/* ---------------------------------------------------------------
   The week
   --------------------------------------------------------------- */
function weekReview(week) {
  const start = weekStart(week);
  const summary = weekSummary(start);
  const saved = summary.saved;
  const current = start === weekStart(todayISO());

  return `
    <article class="stack-lg" style="padding-top:4px">
      <a class="back" href="#/reviews">${icon("back", { size: 16 })} Reviews</a>

      <header>
        <p class="eyebrow">${current ? "This week" : "Week of"}</p>
        <h1 class="title" style="margin-top:10px">${esc(formatSpan(start, weekEnd(start)))}</h1>
        <p class="meta num" style="margin-top:12px">
          ${summary.met} of ${summary.standards} standards met${
            summary.learningMinutes ? ` · ${formatDuration(summary.learningMinutes)} learning` : ""}
        </p>
      </header>

      <section class="stack-lg">
        ${summary.perGoal.map(row => `
          <div>
            <div class="section-head"><h2 class="subtitle">${esc(goalTitle(row.goal))}</h2></div>
            ${row.standards.length ? `
              <div class="scoreboard">
                ${row.standards.map(standard => scoreLine(standard)).join("")}
              </div>` : `<p class="meta">No standards on this goal.</p>`}
            ${row.entries.length ? `<p class="meta num" style="margin-top:10px">${row.entries.length} logged</p>` : ""}
          </div>`).join("")}

        <div>
          <div class="section-head"><h2 class="subtitle">Curiosity</h2></div>
          <div class="scoreboard">
            <div class="score">
              <span class="score__label">Learning</span>
              <span class="score__value num">${summary.learningMinutes ? formatDuration(summary.learningMinutes) : "0m"}</span>
            </div>
            ${summary.modulesDone.length ? `
              <div class="score">
                <span class="score__label">Modules completed</span>
                <span class="score__value num">${summary.modulesDone.length}</span>
              </div>` : ""}
          </div>
        </div>
      </section>

      ${questionsForm(WEEK_QUESTIONS, saved)}

      <section>
        <div class="section-head"><h2 class="subtitle">Everything logged</h2></div>
        ${entryList(summary.entries, { empty: "Nothing logged this week." })}
      </section>
    </article>`;
}

function scoreLine(standard) {
  const s = standard;
  const definition = activityType(s.standard.type);

  if (s.standard.unit === "tags") {
    return (s.detail || []).map(tag => `
      <div class="score">
        <span class="score__label">${esc(tagLabel(definition, tag.tag))}</span>
        <span class="score__value ${tag.done ? "is-met" : "is-missed"}">${tag.done ? "✓" : "✕"}</span>
      </div>`).join("");
  }

  const done = round(s.done);
  const target = s.standard.max && s.standard.max !== s.standard.min
    ? `${s.standard.min}–${s.standard.max}` : s.standard.min;
  const unit = s.standard.unit === "hours" ? "h" : "";

  return `
    <div class="score">
      <span class="score__label">${esc(s.standard.title)}</span>
      <span class="score__value num ${s.met ? "is-met" : ""}">${done}${unit} / ${target}${unit}</span>
    </div>`;
}

const round = value => Math.round(value * 10) / 10;

function tagLabel(definition, id) {
  if (!definition || !definition.tags) return id;
  const tag = definition.tags.find(t => t.id === id);
  return tag ? tag.label : id;
}

/* ---------------------------------------------------------------
   The month
   --------------------------------------------------------------- */
function monthReview(month) {
  const summary = monthSummary(month);
  const saved = summary.saved;

  const milestones = summary.perGoal.reduce((sum, row) => sum + row.milestones.length, 0);
  const hit = summary.perGoal.reduce((sum, row) => sum + row.hit, 0);

  return `
    <article class="stack-lg" style="padding-top:4px">
      <a class="back" href="#/reviews">${icon("back", { size: 16 })} Reviews</a>

      <header>
        <p class="eyebrow">Monthly review</p>
        <h1 class="title" style="margin-top:10px">${esc(monthName(month))}</h1>
        <p class="meta num" style="margin-top:12px">
          ${hit} of ${milestones} milestones reached${
            summary.learningMinutes ? ` · ${formatDuration(summary.learningMinutes)} learning` : ""}
        </p>
      </header>

      <section class="stack-lg">
        ${summary.perGoal.map(row => `
          <div>
            <div class="section-head">
              <h2 class="subtitle">${esc(goalTitle(row.goal))}</h2>
              <a class="link" href="#/goal/${row.goal.id}">Open</a>
            </div>

            ${row.metrics.length ? `
              <div class="scoreboard">
                ${row.metrics.map(m => `
                  <div class="score">
                    <span class="score__label">${esc(m.metric.name)}</span>
                    <span class="score__value num">
                      ${esc(formatValue(m.value, m.metric.unit, { decimals: m.metric.decimals ?? null }))}
                      ${m.change ? `<span class="score__change">${m.change > 0 ? "+" : "−"}${esc(formatValue(Math.abs(m.change), m.metric.unit))}</span>` : ""}
                    </span>
                  </div>`).join("")}
              </div>` : ""}

            ${row.milestones.length ? `
              <div style="margin-top:18px">
                ${row.milestones.map(milestone => `
                  <div class="milestone ${milestone.done ? "is-done" : ""}">
                    <span class="milestone__mark ${milestone.done ? "is-done" : ""}" aria-hidden="true">${milestone.done ? "✓" : "○"}</span>
                    <span class="milestone__text">${esc(milestone.title)}</span>
                  </div>`).join("")}
              </div>` : `<p class="meta" style="margin-top:12px">No milestones this month.</p>`}

            ${row.weeks.length ? `
              <p class="meta num" style="margin-top:14px">
                Standards kept in ${row.weeks.filter(w => w.standards.length && w.standards.every(s => s.met)).length}
                of ${row.weeks.length} weeks
              </p>` : ""}
          </div>`).join("")}
      </section>

      ${questionsForm(MONTH_QUESTIONS, saved)}
    </article>`;
}

const goalTitle = goal => goal.key ? goal.key[0].toUpperCase() + goal.key.slice(1) : goal.title;

/* ---------------------------------------------------------------
   The questions
   --------------------------------------------------------------- */
function questionsForm(questions, saved) {
  const answers = (saved && saved.answers) || {};

  return `
    <section id="questions">
      <div class="section-head">
        <h2 class="subtitle">Your notes</h2>
        ${saved ? `<span class="meta">Saved ${formatDate(saved.date || todayISO(), "short")}</span>` : ""}
      </div>
      ${questions.map(question => `
        <label class="field">
          <span class="field__label">${esc(question.prompt)}</span>
          <textarea class="textarea" data-answer="${question.id}" rows="3"
                    placeholder="Keep it short.">${esc(answers[question.id] || "")}</textarea>
        </label>`).join("")}
      <div class="row">
        <button class="button button--solid" data-save-review>${saved ? "Save changes" : "Save review"}</button>
      </div>
    </section>`;
}

/* ---------------------------------------------------------------
   Behaviour
   --------------------------------------------------------------- */
export function mount(root, [kind = "week", key = weekStart()]) {
  hookEntryList(root);

  on(root, "[data-save-review]", "click", async () => {
    const answers = {};
    $$("[data-answer]", root).forEach(box => { answers[box.dataset.answer] = box.value.trim(); });

    if (!Object.values(answers).some(text => text)) {
      toast("Nothing written down yet.", "bad");
      return;
    }

    const period = activePeriod();

    if (kind === "month") {
      const month = monthOf(key) || monthOf(todayISO());
      const existing = state.monthly.find(review => review.month === month);
      const summary = monthSummary(month);
      await save("monthly", {
        id: existing ? existing.id : undefined,
        periodId: period ? period.id : null,
        month,
        answers,
        date: todayISO(),
        snapshot: {
          milestones: summary.perGoal.reduce((sum, row) => sum + row.milestones.length, 0),
          reached: summary.perGoal.reduce((sum, row) => sum + row.hit, 0),
          logged: summary.entries.length,
          learningMinutes: summary.learningMinutes,
        },
      });
    } else {
      const start = weekStart(key);
      const existing = state.weekly.find(review => review.weekStart === start);
      const summary = weekSummary(start);
      await save("weekly", {
        id: existing ? existing.id : undefined,
        periodId: period ? period.id : null,
        weekStart: start,
        answers,
        date: todayISO(),
        snapshot: {
          met: summary.met,
          standards: summary.standards,
          logged: summary.entries.length,
          learningMinutes: summary.learningMinutes,
        },
      });
    }

    toast("Review saved.");
  });
}
