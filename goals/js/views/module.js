/* =====================================================================
   GOALS — one module
   =====================================================================
   Where the actual learning is written down. Notes save themselves as
   you type; the tick at the top is what moves the topic's progress.
   ===================================================================== */

import { byId, modulesOf, resourcesOf, entriesFor, save } from "../store.js";
import { editModule, editResource } from "../forms.js";
import { openLog, entryList, hookEntryList } from "../log.js";
import { resourceRow } from "./topic.js";
import { $, esc, on, formatDuration, todayISO, toast, debounce } from "../util.js";
import { durationMinutes } from "../progress.js";
import { icon } from "../icons.js";

export const title = ([id]) => {
  const module = byId("modules", id);
  return module ? module.title : "Module";
};

export function html([id]) {
  const module = byId("modules", id);
  if (!module) {
    return `<div class="empty"><p class="empty__title">That module is gone.</p>
      <a class="link" href="#/curiosity">Back to curiosity</a></div>`;
  }

  const topic = byId("topics", module.topicId);
  const siblings = modulesOf(module.topicId);
  const index = siblings.findIndex(other => other.id === module.id);
  const resources = resourcesOf({ moduleId: module.id });
  const sessions = entriesFor({ moduleId: module.id });
  const minutes = sessions.reduce((sum, entry) => sum + durationMinutes(entry), 0);

  return `
    <article class="stack-lg" style="padding-top:4px">
      <a class="back" href="#/topic/${module.topicId}">${icon("back", { size: 16 })} ${esc(topic ? topic.title : "Topic")}</a>

      <header>
        <div class="row row--between">
          <p class="eyebrow">Module ${index + 1} of ${siblings.length}</p>
          <button class="link" data-do="edit-module">Edit</button>
        </div>
        <h1 class="title" style="margin-top:10px">${esc(module.title)}</h1>

        <div class="row row--wrap" style="margin-top:20px">
          <button class="button ${module.done ? "" : "button--solid"}" data-do="toggle">
            ${module.done ? "Completed ✓" : "Mark complete"}
          </button>
          <button class="button" data-do="log-learning">${icon("plus", { size: 16 })} Log a session</button>
        </div>

        ${minutes ? `<p class="meta num" style="margin-top:14px">${formatDuration(minutes)} on this module</p>` : ""}
      </header>

      <section>
        <div class="section-head"><h2 class="subtitle">Notes</h2></div>
        <textarea class="textarea textarea--page" id="notes" rows="10"
          placeholder="What did you learn? Write it in your own words — that is the part that sticks.">${esc(module.notes || "")}</textarea>
        <p class="meta" id="saved" aria-live="polite"></p>
      </section>

      <section>
        <div class="section-head">
          <h2 class="subtitle">Resources</h2>
          <button class="link" data-do="new-resource">Save a link</button>
        </div>
        ${resources.length ? `<div class="list">${resources.map(resource => resourceRow(resource)).join("")}</div>`
        : `<div class="empty"><p class="empty__title">Nothing saved for this module.</p></div>`}
      </section>

      ${sessions.length ? `
        <section>
          <div class="section-head"><h2 class="subtitle">Sessions</h2></div>
          ${entryList(sessions)}
        </section>` : ""}

      ${navRow(siblings, index)}
    </article>`;
}

function navRow(siblings, index) {
  const previous = siblings[index - 1];
  const next = siblings[index + 1];
  if (!previous && !next) return "";

  return `
    <nav class="module-nav">
      ${previous ? `<a class="module-nav__link" href="#/module/${previous.id}">
        ${icon("back", { size: 15 })} <span>${esc(previous.title)}</span></a>` : "<span></span>"}
      ${next ? `<a class="module-nav__link module-nav__link--next" href="#/module/${next.id}">
        <span>${esc(next.title)}</span> ${icon("arrow", { size: 15 })}</a>` : ""}
    </nav>`;
}

export function mount(root, [id]) {
  const module = byId("modules", id);
  if (!module) return;

  hookEntryList(root);

  const notes = $("#notes", root);
  const saved = $("#saved", root);

  /* Typing should never cost you a note, and never redraw the page
     from under your cursor either — so it saves quietly. */
  const store = debounce(async () => {
    const current = byId("modules", id);
    if (!current || current.notes === notes.value) return;
    await save("modules", { ...current, notes: notes.value }, { quiet: true });
    saved.textContent = "Saved";
    setTimeout(() => { saved.textContent = ""; }, 1600);
  }, 700);

  notes.addEventListener("input", store);
  notes.addEventListener("blur", store);

  on(root, "[data-do]", "click", async (event, button) => {
    const action = button.dataset.do;
    const current = byId("modules", id);

    if (action === "edit-module") editModule(current);
    if (action === "new-resource") editResource(null, { moduleId: current.id, topicId: current.topicId });
    if (action === "log-learning") openLog("learning", { topicId: current.topicId, moduleId: current.id });

    if (action === "toggle") {
      await save("modules", {
        ...current,
        notes: notes.value,
        done: !current.done,
        doneAt: current.done ? null : todayISO(),
      });
      if (!current.done) toast("Module completed.");
    }
  });

  on(root, "[data-edit-resource]", "click", (event, button) => {
    event.preventDefault();
    event.stopPropagation();
    editResource(byId("resources", button.dataset.editResource), { moduleId: id });
  });

  /* Leaving the page mid-sentence should still keep the sentence. */
  return () => {
    const current = byId("modules", id);
    if (current && notes.value !== (current.notes || "")) {
      save("modules", { ...current, notes: notes.value }, { quiet: true });
    }
  };
}
