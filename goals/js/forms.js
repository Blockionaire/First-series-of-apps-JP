/* =====================================================================
   GOALS — the editors
   =====================================================================
   Every "add" and "edit" in the app, in one place: periods, goals,
   milestones, metrics, standards, notes and resources. They all use the
   same sheet, so adding something never takes you off the page you were
   reading.
   ===================================================================== */

import { state, save, remove, removeCascade, byId, metricsOf, standardsOf,
         milestonesOf, saveSettings } from "./store.js";
import { ACTIVITY_TYPES, UNITS, AGGREGATIONS, activityType } from "./data/types.js";
import { $, esc, sheet, confirmSheet, toast, todayISO, monthOf, monthName } from "./util.js";

/* Read a field of a sheet by id. */
const read = (dialog, id) => {
  const el = $(`#${id}`, dialog);
  if (!el) return null;
  if (el.type === "checkbox") return el.checked;
  return el.value;
};

const number = (dialog, id) => {
  const raw = read(dialog, id);
  return raw === null || raw === "" ? null : Number(raw);
};

/* ---------------------------------------------------------------
   Goal periods
   --------------------------------------------------------------- */
export function editPeriod(period = null) {
  const isNew = !period;
  const year = new Date().getFullYear();

  return sheet({
    title: isNew ? "New goal period" : "Edit period",
    body: `
      <label class="field">
        <span class="field__label">Title</span>
        <input class="input" id="title" maxlength="60"
               value="${esc(period ? period.title : "")}" placeholder="Q1 ${year + 1}">
      </label>
      <div class="field field--split">
        <label>
          <span class="field__label">Starts</span>
          <input class="input" type="date" id="start" value="${esc(period ? period.start : "")}">
        </label>
        <label>
          <span class="field__label">Ends</span>
          <input class="input" type="date" id="end" value="${esc(period ? period.end : "")}">
        </label>
      </div>
      <label class="field">
        <span class="field__label">Description (optional)</span>
        <textarea class="textarea" id="description" rows="3"
                  placeholder="What are these months for?">${esc(period ? period.description : "")}</textarea>
      </label>
      <label class="field">
        <span class="field__label">Status</span>
        <select class="select" id="status">
          ${["active", "planned", "finished"].map(option => `
            <option value="${option}" ${period && period.status === option ? "selected" : ""}>
              ${option[0].toUpperCase() + option.slice(1)}
            </option>`).join("")}
        </select>
      </label>`,
    footer: `
      ${period ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>Save</button>`,
    onMount: (dialog, close) => {
      $("[data-save]", dialog).addEventListener("click", async () => {
        const title = read(dialog, "title").trim();
        const start = read(dialog, "start");
        const end = read(dialog, "end");
        if (!title || !start || !end) return toast("A period needs a title and two dates.", "bad");
        if (end < start) return toast("The end comes before the start.", "bad");

        const saved = await save("periods", {
          id: period ? period.id : undefined,
          title, start, end,
          description: read(dialog, "description").trim(),
          status: read(dialog, "status"),
        });
        if (isNew) await saveSettings({ periodId: saved.id });
        close(saved);
        toast(isNew ? "Period created." : "Saved.");
      });

      hookDelete(dialog, close, period, "periods", {
        title: "Delete this period?",
        message: "Its goals, milestones, metrics and standards go with it. Your logs stay.",
      });
    },
  });
}

/* ---------------------------------------------------------------
   Goals
   --------------------------------------------------------------- */
export function editGoal(goal = null, periodId = null) {
  const isNew = !goal;
  const period = byId("periods", goal ? goal.periodId : periodId);

  return sheet({
    title: isNew ? "New goal" : "Edit goal",
    subtitle: period ? period.title : "",
    body: `
      <label class="field">
        <span class="field__label">The goal</span>
        <input class="input" id="title" maxlength="120" value="${esc(goal ? goal.title : "")}"
               placeholder="Build a noticeably stronger and fitter body">
      </label>
      <label class="field">
        <span class="field__label">Short name</span>
        <input class="input" id="key" maxlength="24" value="${esc(goal ? goal.key || "" : "")}"
               placeholder="health">
      </label>
      <label class="field">
        <span class="field__label">What does reaching it look like?</span>
        <textarea class="textarea" id="objective" rows="3"
                  placeholder="By 31 December…">${esc(goal ? goal.objective : "")}</textarea>
      </label>
      <label class="field">
        <span class="field__label">Why it matters (optional)</span>
        <textarea class="textarea" id="why" rows="3">${esc(goal ? goal.why || "" : "")}</textarea>
      </label>
      <label class="field">
        <span class="field__label">Target date</span>
        <input class="input" type="date" id="targetDate"
               value="${esc(goal ? goal.targetDate || "" : (period ? period.end : ""))}">
      </label>`,
    footer: `
      ${goal ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>Save</button>`,
    onMount: (dialog, close) => {
      $("[data-save]", dialog).addEventListener("click", async () => {
        const title = read(dialog, "title").trim();
        if (!title) return toast("A goal needs a title.", "bad");

        const saved = await save("goals", {
          id: goal ? goal.id : undefined,
          periodId: goal ? goal.periodId : periodId,
          title,
          key: read(dialog, "key").trim().toLowerCase(),
          objective: read(dialog, "objective").trim(),
          why: read(dialog, "why").trim(),
          targetDate: read(dialog, "targetDate") || null,
          order: goal ? goal.order : state.goals.length,
        });
        close(saved);
        toast(isNew ? "Goal added." : "Saved.");
      });

      hookDelete(dialog, close, goal, "goals", {
        title: "Delete this goal?",
        message: "Its milestones, metrics and standards go with it. Logged activity stays, unattached.",
      });
    },
  });
}

/* ---------------------------------------------------------------
   Milestones
   --------------------------------------------------------------- */
export function editMilestone(milestone = null, goalId = null, month = null) {
  const owner = milestone ? milestone.goalId : goalId;
  const goal = byId("goals", owner);
  const period = goal ? byId("periods", goal.periodId) : null;
  const months = period ? monthsBetween(period.start, period.end) : [monthOf(todayISO())];

  return sheet({
    title: milestone ? "Edit milestone" : "New milestone",
    subtitle: goal ? goal.title : "",
    body: `
      <label class="field">
        <span class="field__label">The outcome</span>
        <input class="input" id="title" maxlength="160" value="${esc(milestone ? milestone.title : "")}"
               placeholder="Reach approximately 65 kg">
      </label>
      <label class="field">
        <span class="field__label">Month</span>
        <select class="select" id="month">
          <option value="">No month</option>
          ${months.map(m => `
            <option value="${m}" ${(milestone ? milestone.month : month) === m ? "selected" : ""}>
              ${monthName(m)}
            </option>`).join("")}
        </select>
      </label>
      <label class="switch">
        <input class="checkbox" type="checkbox" id="done" ${milestone && milestone.done ? "checked" : ""}>
        <span>Already reached</span>
      </label>`,
    footer: `
      ${milestone ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>Save</button>`,
    onMount: (dialog, close) => {
      $("[data-save]", dialog).addEventListener("click", async () => {
        const title = read(dialog, "title").trim();
        if (!title) return toast("A milestone needs a description.", "bad");
        const done = read(dialog, "done");

        const saved = await save("milestones", {
          id: milestone ? milestone.id : undefined,
          goalId: owner,
          title,
          month: read(dialog, "month") || null,
          done,
          doneAt: done ? (milestone && milestone.doneAt) || todayISO() : null,
          order: milestone ? milestone.order : milestonesOf(owner).length,
        });
        close(saved);
        toast("Saved.");
      });

      hookDelete(dialog, close, milestone, "milestones", {
        title: "Delete this milestone?",
        message: "It disappears from the month and from the counts.",
      });
    },
  });
}

/* ---------------------------------------------------------------
   Metrics
   --------------------------------------------------------------- */
export function editMetric(metric = null, goalId = null) {
  const owner = metric ? metric.goalId : goalId;
  const goal = byId("goals", owner);

  return sheet({
    title: metric ? "Edit metric" : "New metric",
    subtitle: goal ? goal.title : "",
    body: `
      <label class="field">
        <span class="field__label">Name</span>
        <input class="input" id="name" maxlength="40" value="${esc(metric ? metric.name : "")}"
               placeholder="Bodyweight">
      </label>

      <div class="field field--split">
        <label>
          <span class="field__label">Unit</span>
          <select class="select" id="unit">
            ${UNITS.map(unit => `
              <option value="${unit.id}" ${metric && metric.unit === unit.id ? "selected" : ""}>${unit.label}</option>`).join("")}
          </select>
        </label>
        <label>
          <span class="field__label">Better is</span>
          <select class="select" id="direction">
            <option value="up" ${!metric || metric.direction === "up" ? "selected" : ""}>Higher</option>
            <option value="down" ${metric && metric.direction === "down" ? "selected" : ""}>Lower</option>
          </select>
        </label>
      </div>

      <label class="field">
        <span class="field__label">How it adds up</span>
        <select class="select" id="aggregation">
          ${AGGREGATIONS.map(a => `
            <option value="${a.id}" ${metric && metric.aggregation === a.id ? "selected" : ""}>${a.label} — ${a.help}</option>`).join("")}
        </select>
      </label>

      <label class="field">
        <span class="field__label">Fed by</span>
        <select class="select" id="type">
          <option value="">Nothing yet</option>
          ${ACTIVITY_TYPES.map(type => `
            <option value="${type.id}" ${metric && metric.type === type.id ? "selected" : ""}>${esc(type.label)}</option>`).join("")}
        </select>
      </label>

      <div class="field field--split">
        <label>
          <span class="field__label">Starting point</span>
          <input class="input num" type="number" step="any" id="start"
                 value="${metric && metric.start !== null ? metric.start : ""}">
        </label>
        <label>
          <span class="field__label">Target</span>
          <input class="input num" type="number" step="any" id="target"
                 value="${metric && metric.target !== null ? metric.target : ""}">
        </label>
      </div>

      <label class="switch">
        <input class="checkbox" type="checkbox" id="headline" ${metric && metric.headline ? "checked" : ""}>
        <span>Show this one on the goal card</span>
      </label>`,
    footer: `
      ${metric ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>Save</button>`,
    onMount: (dialog, close) => {
      $("[data-save]", dialog).addEventListener("click", async () => {
        const name = read(dialog, "name").trim();
        if (!name) return toast("A metric needs a name.", "bad");
        const headline = read(dialog, "headline");

        /* Only one metric can be the headline. */
        if (headline) {
          for (const other of metricsOf(owner)) {
            if (other.headline && (!metric || other.id !== metric.id)) {
              await save("metrics", { ...other, headline: false });
            }
          }
        }

        const aggregation = read(dialog, "aggregation");
        const saved = await save("metrics", {
          id: metric ? metric.id : undefined,
          goalId: owner,
          name,
          unit: read(dialog, "unit"),
          direction: read(dialog, "direction"),
          aggregation,
          type: read(dialog, "type") || null,
          source: aggregation === "count" ? "type" : (metric && metric.source === "duration" ? "duration" : "entry"),
          start: number(dialog, "start"),
          target: number(dialog, "target"),
          headline,
          order: metric ? metric.order : metricsOf(owner).length,
        });
        close(saved);
        toast("Saved.");
      });

      hookDelete(dialog, close, metric, "metrics", {
        title: "Delete this metric?",
        message: "The logs behind it stay; only this way of counting them goes.",
      });
    },
  });
}

/* ---------------------------------------------------------------
   Standards
   --------------------------------------------------------------- */
export function editStandard(standard = null, goalId = null) {
  const owner = standard ? standard.goalId : goalId;
  const goal = byId("goals", owner);

  return sheet({
    title: standard ? "Edit standard" : "New standard",
    subtitle: goal ? goal.title : "",
    body: `
      <p class="prose" style="margin-bottom:18px">A standard is behaviour you keep up every week — not an
      outcome you reach once. Those are milestones.</p>

      <label class="field">
        <span class="field__label">Name</span>
        <input class="input" id="title" maxlength="40" value="${esc(standard ? standard.title : "")}"
               placeholder="Strength training">
      </label>

      <label class="field">
        <span class="field__label">Satisfied by</span>
        <select class="select" id="type">
          ${ACTIVITY_TYPES.map(type => `
            <option value="${type.id}" ${standard && standard.type === type.id ? "selected" : ""}>${esc(type.label)}</option>`).join("")}
        </select>
      </label>

      <label class="field">
        <span class="field__label">Counted as</span>
        <select class="select" id="unit">
          <option value="sessions" ${!standard || standard.unit === "sessions" ? "selected" : ""}>Times per week</option>
          <option value="days" ${standard && standard.unit === "days" ? "selected" : ""}>Days per week</option>
          <option value="hours" ${standard && standard.unit === "hours" ? "selected" : ""}>Hours per week</option>
          <option value="tags" ${standard && standard.unit === "tags" ? "selected" : ""}>Every kind of session at least once</option>
        </select>
      </label>

      <div class="field field--split" id="range">
        <label>
          <span class="field__label">At least</span>
          <input class="input num" type="number" step="any" min="0" id="min"
                 value="${standard && standard.min !== null ? standard.min : 1}">
        </label>
        <label>
          <span class="field__label">Ideally up to</span>
          <input class="input num" type="number" step="any" min="0" id="max"
                 value="${standard && standard.max !== null ? standard.max : ""}">
        </label>
      </div>

      <label class="field">
        <span class="field__label">Note (optional)</span>
        <textarea class="textarea" id="note" rows="2">${esc(standard ? standard.note || "" : "")}</textarea>
      </label>`,
    footer: `
      ${standard ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>Save</button>`,
    onMount: (dialog, close) => {
      const unit = $("#unit", dialog);
      const range = $("#range", dialog);
      const sync = () => { range.hidden = unit.value === "tags"; };
      unit.addEventListener("change", sync);
      sync();

      $("[data-save]", dialog).addEventListener("click", async () => {
        const title = read(dialog, "title").trim();
        if (!title) return toast("A standard needs a name.", "bad");
        const type = read(dialog, "type");
        const unitValue = read(dialog, "unit");
        const definition = activityType(type);

        const saved = await save("standards", {
          id: standard ? standard.id : undefined,
          goalId: owner,
          title,
          type,
          unit: unitValue,
          per: "week",
          min: unitValue === "tags" ? 1 : (number(dialog, "min") || 1),
          max: unitValue === "tags" ? null : number(dialog, "max"),
          tags: unitValue === "tags" && definition && definition.tags ? definition.tags.map(t => t.id) : [],
          note: read(dialog, "note").trim(),
          order: standard ? standard.order : standardsOf(owner).length,
        });
        close(saved);
        toast("Saved.");
      });

      hookDelete(dialog, close, standard, "standards", {
        title: "Delete this standard?",
        message: "It stops appearing on Home and in your weekly review.",
      });
    },
  });
}

/* ---------------------------------------------------------------
   Notes
   ---------------------------------------------------------------
   Plain text on a goal, a topic or a module. No editor, on purpose.
   --------------------------------------------------------------- */
export function editNote(note = null, { level, refId, title = "" } = {}) {
  return sheet({
    title: note ? "Edit note" : "New note",
    subtitle: title,
    body: `
      <label class="field">
        <span class="field__label">Heading (optional)</span>
        <input class="input" id="title" maxlength="80" value="${esc(note ? note.title || "" : "")}">
      </label>
      <label class="field">
        <span class="field__label">Note</span>
        <textarea class="textarea" id="text" rows="9"
                  placeholder="What did you work out?">${esc(note ? note.text : "")}</textarea>
      </label>`,
    footer: `
      ${note ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>Save</button>`,
    onMount: (dialog, close) => {
      $("[data-save]", dialog).addEventListener("click", async () => {
        const text = read(dialog, "text").trim();
        if (!text) return toast("An empty note has nothing to save.", "bad");

        const saved = await save("notes", {
          id: note ? note.id : undefined,
          level: note ? note.level : level,
          refId: note ? note.refId : refId,
          title: read(dialog, "title").trim(),
          text,
          date: note ? note.date : todayISO(),
        });
        close(saved);
        toast("Note saved.");
      });

      hookDelete(dialog, close, note, "notes", {
        title: "Delete this note?",
        message: "Gone for good.",
      });
    },
  });
}

/* ---------------------------------------------------------------
   Resources
   --------------------------------------------------------------- */
export const RESOURCE_TYPES = ["YouTube", "Article", "Book", "Podcast", "Website", "Other"];
export const RESOURCE_STATUSES = ["Saved", "In progress", "Completed"];

export function editResource(resource = null, { topicId = null, moduleId = null, goalId = null } = {}) {
  return sheet({
    title: resource ? "Edit resource" : "Save a resource",
    body: `
      <label class="field">
        <span class="field__label">Title</span>
        <input class="input" id="title" maxlength="120" value="${esc(resource ? resource.title : "")}"
               placeholder="How a mechanical watch works">
      </label>
      <label class="field">
        <span class="field__label">Link (optional)</span>
        <input class="input" id="url" type="url" inputmode="url" value="${esc(resource ? resource.url || "" : "")}"
               placeholder="https://">
      </label>
      <div class="field field--split">
        <label>
          <span class="field__label">Kind</span>
          <select class="select" id="type">
            ${RESOURCE_TYPES.map(type => `
              <option value="${type}" ${resource && resource.type === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>
          <span class="field__label">Status</span>
          <select class="select" id="status">
            ${RESOURCE_STATUSES.map(status => `
              <option value="${status}" ${resource && resource.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
      </div>
      <label class="field">
        <span class="field__label">Note (optional)</span>
        <textarea class="textarea" id="note" rows="2">${esc(resource ? resource.note || "" : "")}</textarea>
      </label>`,
    footer: `
      ${resource ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>Save</button>`,
    onMount: (dialog, close) => {
      $("[data-save]", dialog).addEventListener("click", async () => {
        const title = read(dialog, "title").trim();
        if (!title) return toast("A resource needs a title.", "bad");

        const saved = await save("resources", {
          id: resource ? resource.id : undefined,
          topicId: resource ? resource.topicId : topicId,
          moduleId: resource ? resource.moduleId : moduleId,
          goalId: resource ? resource.goalId : goalId,
          title,
          url: read(dialog, "url").trim(),
          type: read(dialog, "type"),
          status: read(dialog, "status"),
          note: read(dialog, "note").trim(),
        });
        close(saved);
        toast("Saved.");
      });

      hookDelete(dialog, close, resource, "resources", {
        title: "Delete this resource?",
        message: "Only the link goes; your notes stay.",
      });
    },
  });
}

/* ---------------------------------------------------------------
   Shared bits
   --------------------------------------------------------------- */
function hookDelete(dialog, close, record, collection, copy) {
  const button = $("[data-delete]", dialog);
  if (!button || !record) return;

  button.addEventListener("click", async () => {
    const sure = await confirmSheet(copy);
    if (!sure) return;
    if (["periods", "goals", "topics", "modules"].includes(collection)) await removeCascade(collection, record.id);
    else await remove(collection, record.id);
    close("deleted");
    toast("Deleted.");
  });
}

export function monthsBetween(start, end) {
  const months = [];
  let cursor = monthOf(start);
  const last = monthOf(end);
  while (cursor <= last) {
    months.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    const next = new Date(y, m, 1);
    cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  }
  return months;
}
