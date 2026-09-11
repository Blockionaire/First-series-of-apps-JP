/* =====================================================================
   GOALS — one topic
   =====================================================================
   What you want out of it, the modules that get you there, and the
   links and notes you gathered on the way. Progress is simply the share
   of modules you have finished.
   ===================================================================== */

import { state, byId, modulesOf, resourcesOf, notesOf, save, entriesFor } from "../store.js";
import { topicProgress } from "../progress.js";
import { editTopic, editModule, editNote, editResource } from "../forms.js";
import { openLog, entryList, hookEntryList } from "../log.js";
import { esc, escLines, on, progressBar, formatDuration, formatDate, monthName,
         todayISO, toast } from "../util.js";
import { icon } from "../icons.js";

export const title = ([id]) => {
  const topic = byId("topics", id);
  return topic ? topic.title : "Topic";
};

export function html([id]) {
  const topic = byId("topics", id);
  if (!topic) {
    return `<div class="empty"><p class="empty__title">That topic is gone.</p>
      <a class="link" href="#/curiosity">Back to curiosity</a></div>`;
  }

  const t = topicProgress(topic);
  const modules = modulesOf(topic.id);
  const resources = resourcesOf({ topicId: topic.id });
  const notes = notesOf("topic", topic.id);
  const sessions = entriesFor({ topicId: topic.id, type: "learning", limit: 6 });

  return `
    <article class="stack-lg" style="padding-top:4px">
      <a class="back" href="#/curiosity">${icon("back", { size: 16 })} Curiosity</a>

      <div class="topic-hero topic__cover ${topic.cover ? "" : "topic__cover--tinted"}"
           style="--tint:${topic.tint || 30}">
        ${topic.cover
          ? `<img src="${esc(topic.cover)}" alt="">`
          : `<span class="topic__letter">${esc(topic.title.slice(0, 1))}</span>`}
      </div>

      <header>
        <div class="row row--between">
          <p class="eyebrow">${esc(topic.month ? monthName(topic.month) : statusLabel(topic.status))}</p>
          <button class="link" data-do="edit-topic">Edit</button>
        </div>
        <h1 class="title" style="margin-top:10px">${esc(topic.title)}</h1>
        ${topic.outcome ? `<p class="lead" style="margin-top:14px">${esc(topic.outcome)}</p>` : ""}
        <p class="meta num" style="margin-top:16px">
          ${t.done} / ${t.total} modules${t.minutes ? ` · ${formatDuration(t.minutes)} spent` : ""}
        </p>
        <div style="margin-top:10px;max-width:380px">${progressBar(t.fraction)}</div>
        <div class="row row--wrap" style="margin-top:20px">
          <button class="button" data-do="log-learning">${icon("plus", { size: 16 })} Log a session</button>
          ${topic.status !== "current"
            ? `<button class="button button--ghost" data-do="make-current">Make this the current topic</button>`
            : ""}
          ${t.total && t.done === t.total && topic.status !== "completed"
            ? `<button class="button button--ghost" data-do="finish">Mark topic done</button>`
            : ""}
        </div>
      </header>

      <section>
        <div class="section-head">
          <h2 class="subtitle">Modules</h2>
          <button class="link" data-do="new-module">Add module</button>
        </div>
        ${modules.length ? modules.map((module, index) => `
          <div class="module ${module.done ? "is-done" : ""}">
            <input class="checkbox" type="checkbox" data-tick="${module.id}" ${module.done ? "checked" : ""}
                   aria-label="${esc(module.title)}">
            <span class="module__index num">${String(index + 1).padStart(2, "0")}</span>
            <a class="module__title" href="#/module/${module.id}">${esc(module.title)}</a>
            ${module.notes ? `<span class="module__mark" title="Has notes">${icon("book", { size: 15 })}</span>` : ""}
          </div>`).join("")
        : `<div class="empty"><p class="empty__title">No modules yet.</p>
             <p>Five to ten is usually the right size for a topic.</p></div>`}
      </section>

      <section>
        <div class="section-head">
          <h2 class="subtitle">Resources</h2>
          <button class="link" data-do="new-resource">Save a link</button>
        </div>
        ${resources.length ? `<div class="list">${resources.map(resource => resourceRow(resource)).join("")}</div>`
        : `<div class="empty"><p class="empty__title">Nothing saved yet.</p>
             <p>Videos, articles, books — whatever you want to come back to.</p></div>`}
      </section>

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
        : `<div class="empty"><p class="empty__title">No notes yet.</p></div>`}
      </section>

      ${sessions.length ? `
        <section>
          <div class="section-head"><h2 class="subtitle">Recent sessions</h2></div>
          ${entryList(sessions)}
        </section>` : ""}
    </article>`;
}

export function resourceRow(resource) {
  const inner = `
    <span class="list__main">
      <span class="list__title">${esc(resource.title)}</span>
      <span class="list__sub">${esc(resource.type || "")}${resource.note ? ` · ${esc(resource.note)}` : ""}</span>
    </span>
    <span class="list__side">${esc(resource.status || "")}</span>
    <button class="icon-button" data-edit-resource="${resource.id}" aria-label="Edit">${icon("edit", { size: 15 })}</button>`;

  return resource.url
    ? `<a class="list__item" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<div class="list__item">${inner}</div>`;
}

const statusLabel = status =>
  status === "current" ? "Currently learning" : status === "completed" ? "Done" : "Coming up";

export function mount(root, [id]) {
  const topic = byId("topics", id);
  if (!topic) return;

  hookEntryList(root);

  on(root, "[data-do]", "click", async (event, button) => {
    const action = button.dataset.do;
    if (action === "edit-topic") editTopic(topic);
    if (action === "new-module") editModule(null, topic.id);
    if (action === "new-note") editNote(null, { level: "topic", refId: topic.id, title: topic.title });
    if (action === "new-resource") editResource(null, { topicId: topic.id });
    if (action === "log-learning") openLog("learning", { topicId: topic.id });

    if (action === "make-current") {
      for (const other of state.topics) {
        if (other.status === "current") await save("topics", { ...other, status: "upcoming" });
      }
      await save("topics", { ...topic, status: "current" });
      toast(`${topic.title} is now the current topic.`);
    }

    if (action === "finish") {
      await save("topics", { ...topic, status: "completed" });
      toast("Topic marked done.");
    }
  });

  on(root, "[data-tick]", "change", async (event, box) => {
    const module = byId("modules", box.dataset.tick);
    if (!module) return;
    await save("modules", {
      ...module,
      done: box.checked,
      doneAt: box.checked ? todayISO() : null,
    });
    if (box.checked) toast("Module completed.");
  });

  on(root, "[data-note]", "click", (event, article) =>
    editNote(byId("notes", article.dataset.note), { level: "topic", refId: topic.id, title: topic.title }));

  on(root, "[data-edit-resource]", "click", (event, button) => {
    event.preventDefault();
    event.stopPropagation();
    editResource(byId("resources", button.dataset.editResource), { topicId: topic.id });
  });
}
