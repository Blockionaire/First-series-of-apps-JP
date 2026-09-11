/* =====================================================================
   GOALS — curiosity
   =====================================================================
   Everything you want to understand that is not a goal. One topic at a
   time, the rest waiting their turn, and a backlog for the ideas that
   are not topics yet.
   ===================================================================== */

import { state, entriesFor } from "../store.js";
import { topicProgress } from "../progress.js";
import { editTopic, editBacklog, promoteBacklog } from "../forms.js";
import { openLog } from "../log.js";
import { esc, on, progressBar, formatDuration, monthName, confirmSheet } from "../util.js";
import { durationMinutes } from "../progress.js";
import { icon } from "../icons.js";

export const title = () => "Curiosity";

export function html() {
  const current = state.topics.find(topic => topic.status === "current");
  const upcoming = state.topics.filter(topic => topic.status === "upcoming");
  const completed = state.topics.filter(topic => topic.status === "completed");
  const minutes = entriesFor({ type: "learning" }).reduce((sum, entry) => sum + durationMinutes(entry), 0);

  return `
    <div class="stack-xl" style="padding-top:8px">
      <header>
        <p class="eyebrow">Curiosity</p>
        <h1 class="title" style="margin-top:10px">What I am learning</h1>
        <p class="lead" style="margin-top:14px">Outside the goals: the things worth understanding for
        their own sake.</p>
        ${minutes ? `<p class="meta num" style="margin-top:12px">${formatDuration(minutes)} of learning so far</p>` : ""}
      </header>

      ${current ? currentBlock(current) : ""}

      ${upcoming.length ? `
        <section>
          <div class="section-head">
            <h2 class="subtitle">Coming up</h2>
            <button class="link" data-do="new-topic">Add topic</button>
          </div>
          <div class="topic-grid">${upcoming.map(topic => topicCard(topic)).join("")}</div>
        </section>` : `
        <section>
          <div class="section-head"><h2 class="subtitle">Coming up</h2></div>
          <div class="empty">
            <p class="empty__title">Nothing lined up.</p>
            <p><button class="link" data-do="new-topic">Add a topic</button></p>
          </div>
        </section>`}

      ${completed.length ? `
        <section>
          <div class="section-head"><h2 class="subtitle">Done</h2></div>
          <div class="topic-grid">${completed.map(topic => topicCard(topic)).join("")}</div>
        </section>` : ""}

      <section>
        <div class="section-head">
          <h2 class="subtitle">Backlog</h2>
          <button class="link" data-do="new-backlog">${icon("plus", { size: 14 })} Add curiosity</button>
        </div>
        ${state.backlog.length ? `
          <div class="list">
            ${state.backlog.map(item => `
              <div class="list__item backlog">
                <span class="list__main" data-backlog="${item.id}">
                  <span class="list__title">${esc(item.title)}</span>
                  ${item.note ? `<span class="list__sub">${esc(item.note)}</span>` : ""}
                </span>
                <button class="button button--small" data-promote="${item.id}">Make it a topic</button>
              </div>`).join("")}
          </div>` : `
          <div class="empty">
            <p class="empty__title">Nothing waiting.</p>
            <p>Anything you catch yourself wondering about goes here.</p>
          </div>`}
      </section>
    </div>`;
}

function currentBlock(topic) {
  const t = topicProgress(topic);

  return `
    <section>
      <div class="section-head">
        <h2 class="subtitle">Currently learning</h2>
        <button class="link" data-do="log-learning">Log a session</button>
      </div>

      <a class="learning" href="#/topic/${topic.id}">
        <div class="learning__cover topic__cover ${topic.cover ? "" : "topic__cover--tinted"}"
             style="--tint:${topic.tint || 30}">
          ${topic.cover
            ? `<img src="${esc(topic.cover)}" alt="">`
            : `<span class="topic__letter">${esc(topic.title.slice(0, 1))}</span>`}
        </div>
        <div class="learning__body">
          ${topic.month ? `<p class="eyebrow">${esc(monthName(topic.month))}</p>` : ""}
          <h3 class="learning__title">${esc(topic.title)}</h3>
          ${topic.outcome ? `<p class="prose" style="margin-top:10px">${esc(topic.outcome)}</p>` : ""}
          <p class="meta num" style="margin-top:14px">${t.done} / ${t.total} modules${
            t.minutes ? ` · ${formatDuration(t.minutes)}` : ""}</p>
          <div style="margin-top:10px;max-width:280px">${progressBar(t.fraction)}</div>
          ${t.next ? `<p class="learning__next"><span class="faint">Next</span> ${esc(t.next.title)}</p>` : ""}
          <span class="button button--small" style="margin-top:16px">Continue</span>
        </div>
      </a>
    </section>`;
}

function topicCard(topic) {
  const t = topicProgress(topic);

  return `
    <a class="topic" href="#/topic/${topic.id}">
      <div class="topic__cover ${topic.cover ? "" : "topic__cover--tinted"}" style="--tint:${topic.tint || 30}">
        ${topic.cover
          ? `<img src="${esc(topic.cover)}" alt="">`
          : `<span class="topic__letter">${esc(topic.title.slice(0, 1))}</span>`}
      </div>
      <h3 class="topic__title">${esc(topic.title)}</h3>
      <p class="topic__meta num">${topic.month ? `${monthName(topic.month)} · ` : ""}${t.done} / ${t.total} modules</p>
      <div class="topic__bar">${progressBar(t.fraction)}</div>
    </a>`;
}

export function mount(root) {
  on(root, "[data-do]", "click", (event, button) => {
    const action = button.dataset.do;
    if (action === "new-topic") editTopic(null);
    if (action === "new-backlog") editBacklog(null);
    if (action === "log-learning") openLog("learning");
  });

  on(root, "[data-backlog]", "click", (event, element) => {
    const item = state.backlog.find(row => row.id === element.dataset.backlog);
    if (item) editBacklog(item);
  });

  on(root, "[data-promote]", "click", async (event, button) => {
    event.stopPropagation();
    const item = state.backlog.find(row => row.id === button.dataset.promote);
    if (!item) return;
    const sure = await confirmSheet({
      title: `Make “${item.title}” a topic?`,
      message: "It moves out of the backlog and into Coming up, where you can give it modules.",
      confirmLabel: "Make it a topic",
      danger: false,
    });
    if (!sure) return;
    const topic = await promoteBacklog(item);
    location.hash = `#/topic/${topic.id}`;
  });
}
