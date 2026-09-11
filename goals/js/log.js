/* =====================================================================
   GOALS — logging
   =====================================================================
   The sheet that opens from the ＋ in the tab bar and from every quick
   action on Home. Two steps at most: pick what you are logging, fill in
   the one or two fields that type actually has, save.

   Which fields appear is decided by the type in data/types.js, so a
   weight reading never asks for a duration and a gym session never asks
   for an amount.
   ===================================================================== */

import { state, logEntry, remove, goalForType, loggableTypes,
         byId, currentTopic, modulesOf } from "./store.js";
import { activityType } from "./data/types.js";
import { $, $$, esc, sheet, confirmSheet, toast, todayISO, formatValue,
         formatDate, relativeDay } from "./util.js";
import { durationMinutes } from "./progress.js";

/* ---------------------------------------------------------------
   Step one: what are you logging?
   --------------------------------------------------------------- */
export function openLog(type = null, extra = {}) {
  if (type) return openForm(type, extra);

  const options = loggableTypes();

  sheet({
    title: "Log something",
    subtitle: todayLabel(),
    body: `
      <div class="log-picker">
        ${options.map(option => {
          const definition = activityType(option.type);
          if (!definition) return "";
          const goal = option.goalId ? byId("goals", option.goalId) : null;
          return `
            <button class="log-picker__item" data-type="${esc(option.type)}">
              <span class="log-picker__label">${esc(definition.label)}</span>
              <span class="log-picker__goal">${esc(goal ? goalName(goal) : "Curiosity")}</span>
            </button>`;
        }).join("")}
      </div>`,
    onMount: (dialog, close) => {
      $$("[data-type]", dialog).forEach(button => {
        button.addEventListener("click", () => {
          close(null);
          openForm(button.dataset.type, extra);
        });
      });
    },
  });
}

/* A goal's short name for a button: the seeded key reads better than
   the full sentence, but a goal you added yourself has no key. */
function goalName(goal) {
  if (goal.key) return goal.key[0].toUpperCase() + goal.key.slice(1);
  return goal.title.length > 22 ? goal.title.slice(0, 20) + "…" : goal.title;
}

const todayLabel = () => formatDate(todayISO(), "day");

/* ---------------------------------------------------------------
   Step two: the fields for that type
   --------------------------------------------------------------- */
export function openForm(type, { entry = null, topicId = null, moduleId = null, date = null } = {}) {
  const definition = activityType(type);
  if (!definition) return toast("Unknown type of log.", "bad");

  const existing = entry;
  const fields = definition.fields || [];
  const topic = topicId ? byId("topics", topicId) : currentTopic();

  const value = existing ? existing.value : null;
  const duration = existing ? existing.duration : (definition.defaultDuration || null);

  sheet({
    title: existing ? `Edit ${definition.label.toLowerCase()}` : definition.action || definition.label,
    subtitle: existing ? formatDate(existing.date, "long") : "",
    body: `
      <label class="field">
        <span class="field__label">Date</span>
        <input class="input" type="date" id="date"
               value="${esc(existing ? existing.date : (date || todayISO()))}" max="${todayISO()}">
      </label>

      ${fields.includes("value") ? `
        <label class="field">
          <span class="field__label">${esc(definition.valueLabel || "Value")}${definition.unit ? ` (${unitWord(definition.unit)})` : ""}</span>
          <input class="input num" type="number" inputmode="decimal" id="value"
                 step="${definition.step || 1}" value="${value === null ? "" : value}"
                 placeholder="${esc(definition.placeholder || "")}">
        </label>` : ""}

      ${fields.includes("duration") ? `
        <label class="field">
          <span class="field__label">${esc(definition.durationLabel || "Duration")} (${definition.duration === "hours" ? "hours" : "minutes"})</span>
          <input class="input num" type="number" inputmode="decimal" id="duration"
                 step="${definition.duration === "hours" ? "0.25" : "5"}" min="0"
                 value="${duration === null ? "" : duration}">
        </label>` : ""}

      ${fields.includes("tags") && definition.tags ? `
        <div class="field">
          <span class="field__label">This session was</span>
          <div class="chips" id="tags">
            ${definition.tags.map(tag => `
              <button type="button" class="chip ${existing && (existing.tags || []).includes(tag.id) ? "is-on" : ""}"
                      data-tag="${esc(tag.id)}">${esc(tag.label)}</button>`).join("")}
          </div>
        </div>` : ""}

      ${fields.includes("topic") ? topicField(existing, topic, moduleId) : ""}

      ${fields.includes("note") ? `
        <label class="field">
          <span class="field__label">Note${definition.noteRequired ? "" : " (optional)"}</span>
          <input class="input" id="note" value="${esc(existing ? existing.note : "")}"
                 placeholder="${esc(definition.notePlaceholder || "")}" maxlength="280">
        </label>` : ""}

      ${fields.includes("reflection") ? `
        <div class="field">
          <span class="field__label">Reflection (optional)</span>
          ${definition.reflection.map(prompt => `
            <p class="log-prompt">${esc(prompt.prompt)}</p>
            <textarea class="textarea textarea--small" data-reflect="${esc(prompt.id)}"
                      rows="2">${esc(existing && existing.reflection ? existing.reflection[prompt.id] || "" : "")}</textarea>
          `).join("")}
        </div>` : ""}
    `,
    footer: `
      ${existing ? `<button class="button button--ghost" data-delete>Delete</button>` : ""}
      <button class="button button--ghost" data-close>Cancel</button>
      <button class="button button--solid" data-save>${existing ? "Save" : "Log it"}</button>`,
    onMount: (dialog, close) => {
      $$("[data-tag]", dialog).forEach(chip =>
        chip.addEventListener("click", () => chip.classList.toggle("is-on")));

      const topicSelect = $("#topic", dialog);
      if (topicSelect) {
        topicSelect.addEventListener("change", () => {
          const moduleSelect = $("#module", dialog);
          if (moduleSelect) moduleSelect.innerHTML = moduleOptions(topicSelect.value, null);
        });
      }

      $("[data-save]", dialog).addEventListener("click", async () => {
        const read = id => { const el = $(`#${id}`, dialog); return el ? el.value : null; };
        const number = id => {
          const raw = read(id);
          return raw === null || raw === "" ? null : Number(raw);
        };

        const reflection = {};
        $$("[data-reflect]", dialog).forEach(box => { reflection[box.dataset.reflect] = box.value.trim(); });

        const chosenTopic = read("topic") || null;
        const chosenModule = read("module") || null;

        const record = {
          id: existing ? existing.id : null,
          type,
          date: read("date") || todayISO(),
          value: number("value"),
          duration: number("duration"),
          note: read("note") || "",
          tags: $$("[data-tag].is-on", dialog).map(chip => chip.dataset.tag),
          goalId: goalForType(type),
          topicId: chosenTopic,
          moduleId: chosenModule,
          reflection: Object.keys(reflection).length ? reflection : null,
        };

        if (definition.noteRequired && !record.note) {
          toast("Add a name first.", "bad");
          return;
        }
        if (record.value === null && record.duration === null &&
            !record.note && !(definition.fields || []).includes("tags")) {
          toast("Nothing to log yet.", "bad");
          return;
        }

        await logEntry(record);
        close(true);
        toast(existing ? "Changed." : logLine(type, record));
      });

      const deleteButton = $("[data-delete]", dialog);
      if (deleteButton) {
        deleteButton.addEventListener("click", async () => {
          const sure = await confirmSheet({
            title: "Delete this log?",
            message: "It disappears from your totals as well.",
          });
          if (!sure) return;
          await remove("entries", existing.id);
          close(true);
          toast("Deleted.");
        });
      }
    },
  });
}

function topicField(existing, topic, moduleId) {
  const currentTopicId = existing ? existing.topicId : (topic ? topic.id : "");
  return `
    <div class="field field--split">
      <label>
        <span class="field__label">Topic</span>
        <select class="select" id="topic">
          <option value="">—</option>
          ${state.topics.map(t => `
            <option value="${t.id}" ${t.id === currentTopicId ? "selected" : ""}>${esc(t.title)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span class="field__label">Module</span>
        <select class="select" id="module">
          ${moduleOptions(currentTopicId, existing ? existing.moduleId : moduleId)}
        </select>
      </label>
    </div>`;
}

function moduleOptions(topicId, selected) {
  const modules = topicId ? modulesOf(topicId) : [];
  return `<option value="">—</option>` + modules.map(module => `
    <option value="${module.id}" ${module.id === selected ? "selected" : ""}>${esc(module.title)}</option>`).join("");
}

function unitWord(unit) {
  return { kg: "kg", km: "km", eur: "€", hours: "hours", minutes: "minutes", count: "number" }[unit] || unit;
}

/* A confirmation that repeats the number back, so a mistyped weight is
   obvious before it lands in a chart. */
function logLine(type, record) {
  const definition = activityType(type);
  if (record.value !== null && definition.unit) return `Logged ${formatValue(record.value, definition.unit)}.`;
  if (record.duration !== null) return `Logged ${definition.label.toLowerCase()}.`;
  return "Logged.";
}

/* ---------------------------------------------------------------
   How a log reads in a list
   --------------------------------------------------------------- */
export function entryLine(entry) {
  const definition = activityType(entry.type);
  const bits = [];

  if (entry.value !== null && entry.value !== undefined && definition && definition.unit) {
    bits.push(formatValue(entry.value, definition.unit));
  }
  if (entry.duration) {
    const minutes = durationMinutes(entry);
    bits.push(minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)}h` : `${Math.round(minutes)}m`);
  }
  if (entry.tags && entry.tags.length && definition && definition.tags) {
    bits.push(entry.tags
      .map(tag => (definition.tags.find(t => t.id === tag) || {}).label)
      .filter(Boolean)
      .join(" + "));
  }
  return bits.join(" · ");
}

export function entryList(entries, { empty = "Nothing logged yet." } = {}) {
  if (!entries.length) return `<div class="empty"><p class="empty__title">${esc(empty)}</p></div>`;

  return `<div class="list">${entries.map(entry => {
    const definition = activityType(entry.type);
    const detail = entryLine(entry);
    return `
      <button class="list__item" data-entry="${entry.id}">
        <span class="list__main">
          <span class="list__title">${esc(definition ? definition.label : entry.type)}${detail ? ` <span class="faint">${esc(detail)}</span>` : ""}</span>
          ${entry.note ? `<span class="list__sub">${esc(entry.note)}</span>` : ""}
          ${entry.reflection ? `<span class="list__sub">Reflection saved</span>` : ""}
        </span>
        <span class="list__side">${esc(relativeDay(entry.date))}</span>
      </button>`;
  }).join("")}</div>`;
}

/* Wire an activity list so tapping a row edits that log. */
export function hookEntryList(root) {
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-entry]");
    if (!button) return;
    const entry = byId("entries", button.dataset.entry);
    if (entry) openForm(entry.type, { entry });
  });
}
