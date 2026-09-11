/* =====================================================================
   GOALS — working out where you stand
   =====================================================================
   Pure reading, no writing. Metrics and standards are stored as
   definitions, never as computed numbers, so a corrected log always
   fixes the totals instead of leaving two versions of the truth.
   ===================================================================== */

import { state, byId, metricsOf, standardsOf, milestonesOf, modulesOf,
         goalsOf, activePeriod, entriesFor } from "./store.js";
import { activityType } from "./data/types.js";
import { weekStart, weekEnd, monthStart, monthEnd, fromISO, todayISO,
         daysBetween, clamp, monthOf } from "./util.js";

/* Duration is stored in the unit the type uses. Everything that adds
   durations together goes through here first. */
export function durationHours(entry) {
  const type = activityType(entry.type);
  if (!entry.duration) return 0;
  return type && type.duration === "hours" ? entry.duration : entry.duration / 60;
}

export function durationMinutes(entry) {
  const type = activityType(entry.type);
  if (!entry.duration) return 0;
  return type && type.duration === "hours" ? entry.duration * 60 : entry.duration;
}

/* ---------------------------------------------------------------
   Metrics
   --------------------------------------------------------------- */
export function metricEntries(metric, { from = null, to = null } = {}) {
  if (!metric.type) return [];
  return entriesFor({ type: metric.type, from, to })
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/* One metric, one answer: where it started, where it is, where it is
   going, and how far along that is. */
export function metricValue(metric, { from = null, to = null } = {}) {
  const period = periodBounds(metric.goalId, from, to);
  const entries = metricEntries(metric, period);

  const numbers = entries
    .filter(e => e.value !== null && e.value !== undefined && !isNaN(e.value))
    .map(e => ({ date: e.date, value: Number(e.value) }));

  let current = null;
  switch (metric.aggregation) {
    case "count":
      current = entries.length;
      break;
    case "cumulative":
      current = metric.source === "duration"
        ? entries.reduce((sum, e) => sum + durationHours(e), 0)
        : numbers.reduce((sum, n) => sum + n.value, 0);
      break;
    case "average":
      current = numbers.length ? numbers.reduce((s, n) => s + n.value, 0) / numbers.length : null;
      break;
    case "max":
      current = numbers.length ? Math.max(...numbers.map(n => n.value)) : null;
      break;
    default: /* latest */
      current = numbers.length ? numbers[numbers.length - 1].value : null;
  }

  if (current === null && metric.start !== null && metric.aggregation === "latest") current = metric.start;

  /* The line on the goal page: a running total draws its own build-up,
     a reading draws the readings. */
  let series = [];
  if (metric.aggregation === "cumulative") {
    let running = metric.start || 0;
    series = entries.map(e => {
      running += metric.source === "duration" ? durationHours(e) : (Number(e.value) || 0);
      return { date: e.date, value: running };
    });
  } else if (metric.aggregation === "count") {
    series = entries.map((e, i) => ({ date: e.date, value: i + 1 }));
  } else {
    series = numbers;
  }

  return {
    metric,
    current,
    start: metric.start,
    target: metric.target,
    entries,
    series,
    lastDate: entries.length ? entries[entries.length - 1].date : null,
    fraction: fractionOf(metric, current),
    remaining: metric.target === null || current === null ? null
      : metric.direction === "down" ? current - metric.target : metric.target - current,
  };
}

function fractionOf(metric, current) {
  if (metric.target === null || current === null) return null;
  const start = metric.start === null ? 0 : metric.start;
  const span = metric.direction === "down" ? start - metric.target : metric.target - start;
  if (!span) return current === metric.target ? 1 : 0;
  const done = metric.direction === "down" ? start - current : current - start;
  return clamp(done / span, 0, 1);
}

/* A metric belongs to a goal, and a goal to a period — so unless a
   screen asks for something else, a metric only counts what was logged
   inside its own period. */
function periodBounds(goalId, from, to) {
  if (from || to) return { from, to };
  const goal = byId("goals", goalId);
  const period = goal ? byId("periods", goal.periodId) : null;
  return period ? { from: period.start, to: period.end } : { from: null, to: null };
}

export const headlineMetric = goalId =>
  metricsOf(goalId).find(m => m.headline) || metricsOf(goalId).find(m => m.target !== null) || metricsOf(goalId)[0] || null;

/* ---------------------------------------------------------------
   Standards
   ---------------------------------------------------------------
   Behaviour to maintain, always measured over one week.
   --------------------------------------------------------------- */
export function standardWeek(standard, week = weekStart()) {
  const from = weekStart(week), to = weekEnd(week);
  const entries = entriesFor({ type: standard.type, from, to });

  let done = 0;
  let target = standard.min || 0;
  let detail = "";

  if (standard.unit === "hours") {
    done = entries.reduce((sum, e) => sum + durationHours(e), 0);
  } else if (standard.unit === "days") {
    done = new Set(entries.map(e => e.date)).size;
  } else if (standard.unit === "tags") {
    const present = new Set(entries.flatMap(e => e.tags || []));
    const tags = standard.tags || [];
    done = tags.filter(tag => present.has(tag)).length;
    target = tags.length;
    detail = tags.map(tag => ({ tag, done: present.has(tag) }));
  } else {
    done = entries.length;
  }

  const days = Array.from(new Set(entries.map(e => (fromISO(e.date).getDay() + 6) % 7)));

  return {
    standard, from, to, entries, done, target, detail, days,
    met: done >= target,
    fraction: target ? clamp(done / target, 0, 1) : (done ? 1 : 0),
  };
}

/* ---------------------------------------------------------------
   Goals
   --------------------------------------------------------------- */
export function nextMilestone(goalId) {
  const open = milestonesOf(goalId).filter(m => !m.done);
  if (!open.length) return null;
  const thisMonth = monthOf(todayISO());
  return open.find(m => (m.month || "9999") >= thisMonth) || open[0];
}

export function goalProgress(goal) {
  const metric = headlineMetric(goal.id);
  const value = metric ? metricValue(metric) : null;
  const milestones = milestonesOf(goal.id);
  const standards = standardsOf(goal.id).map(s => standardWeek(s));

  return {
    goal,
    metric,
    value,
    milestones,
    done: milestones.filter(m => m.done).length,
    total: milestones.length,
    standards,
    next: nextMilestone(goal.id),
  };
}

/* ---------------------------------------------------------------
   The period itself
   --------------------------------------------------------------- */
export function periodProgress(period = activePeriod()) {
  if (!period) return null;
  const today = todayISO();
  const total = Math.max(1, daysBetween(period.start, period.end));
  const gone = clamp(daysBetween(period.start, today), 0, total);
  const left = daysBetween(today, period.end);

  return {
    period,
    total,
    gone,
    left,
    fraction: gone / total,
    started: today >= period.start,
    ended: today > period.end,
    weeksLeft: Math.max(0, Math.ceil(left / 7)),
    goals: goalsOf(period.id),
  };
}

/* ---------------------------------------------------------------
   Curiosity
   --------------------------------------------------------------- */
export function topicProgress(topic) {
  const modules = modulesOf(topic.id);
  const done = modules.filter(m => m.done).length;
  const minutes = entriesFor({ topicId: topic.id, type: "learning" })
    .reduce((sum, e) => sum + durationMinutes(e), 0);
  return {
    topic, modules, done, total: modules.length, minutes,
    fraction: modules.length ? done / modules.length : 0,
    next: modules.find(m => !m.done) || null,
  };
}

/* ---------------------------------------------------------------
   Reviews
   ---------------------------------------------------------------
   One snapshot shape for a week and for a month, so the two review
   screens and the saved review all read the same numbers.
   --------------------------------------------------------------- */
export function weekSummary(week = weekStart()) {
  const from = weekStart(week), to = weekEnd(week);
  const period = activePeriod();
  const goals = period ? goalsOf(period.id) : [];

  const perGoal = goals.map(goal => ({
    goal,
    standards: standardsOf(goal.id).map(s => standardWeek(s, from)),
    entries: entriesFor({ goalId: goal.id, from, to }),
  })).filter(row => row.standards.length || row.entries.length);

  const learning = entriesFor({ type: "learning", from, to });
  const learningMinutes = learning.reduce((sum, e) => sum + durationMinutes(e), 0);
  const modulesDone = state.modules.filter(m => m.done && m.doneAt &&
    m.doneAt >= from && m.doneAt <= to);

  const all = perGoal.flatMap(r => r.standards);

  return {
    from, to, perGoal, learning, learningMinutes, modulesDone,
    entries: entriesFor({ from, to }),
    met: all.filter(s => s.met).length,
    standards: all.length,
    saved: state.weekly.find(w => w.weekStart === from) || null,
  };
}

export function monthSummary(month = monthOf(todayISO())) {
  const from = monthStart(month), to = monthEnd(month);
  const period = activePeriod();
  const goals = period ? goalsOf(period.id) : [];

  const perGoal = goals.map(goal => {
    const milestones = milestonesOf(goal.id).filter(m => m.month === month);
    const metrics = metricsOf(goal.id).map(metric => {
      const full = metricValue(metric);
      const upto = metricValue(metric, { from: period.start, to });
      const before = metricValue(metric, { from: period.start, to: shiftDay(from, -1) });
      return {
        metric,
        value: upto.current,
        before: before.current,
        change: upto.current !== null && before.current !== null ? upto.current - before.current : null,
        target: metric.target,
        fraction: full.fraction,
      };
    });

    /* Only weeks that have actually started — a month in progress
       should not report failures for weeks that have not happened. */
    const today = todayISO();
    const weeks = weeksIn(from, to)
      .filter(w => w <= today)
      .map(w => ({
        week: w,
        standards: standardsOf(goal.id).map(s => standardWeek(s, w)),
      }));

    return {
      goal, milestones, metrics, weeks,
      entries: entriesFor({ goalId: goal.id, from, to }),
      hit: milestones.filter(m => m.done).length,
      missed: milestones.filter(m => !m.done).length,
    };
  });

  const learning = entriesFor({ type: "learning", from, to });

  return {
    month, from, to, perGoal,
    learning,
    learningMinutes: learning.reduce((sum, e) => sum + durationMinutes(e), 0),
    modulesDone: state.modules.filter(m => m.done && m.doneAt && m.doneAt >= from && m.doneAt <= to),
    entries: entriesFor({ from, to }),
    saved: state.monthly.find(m => m.month === month) || null,
  };
}

function shiftDay(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function weeksIn(from, to) {
  const weeks = [];
  let cursor = weekStart(from);
  while (cursor <= to) {
    if (weekEnd(cursor) >= from) weeks.push(cursor);
    cursor = shiftDay(cursor, 7);
  }
  return weeks;
}

/* Weeks of a period that are already behind us — the review list. */
export function pastWeeks(period = activePeriod(), limit = 20) {
  if (!period) return [];
  const today = todayISO();
  return weeksIn(period.start, period.end < today ? period.end : today)
    .reverse()
    .slice(0, limit);
}

export function pastMonths(period = activePeriod()) {
  if (!period) return [];
  const months = [];
  let cursor = monthOf(period.start);
  const last = monthOf(period.end);
  while (cursor <= last) {
    months.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    const next = new Date(y, m, 1);
    cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  }
  return months.reverse();
}
