/* =====================================================================
   GOALS — search
   =====================================================================
   One field over goals, milestones, topics, modules, notes, resources
   and anything you wrote on a log. Plain substring matching, accents
   folded away. Nothing clever, and it does not need to be.
   ===================================================================== */

import { search } from "../store.js";
import { $, esc, on, debounce } from "../util.js";

export const title = () => "Search";

export function html() {
  return `
    <section class="stack-lg" style="padding-top:12px">
      <div>
        <label class="visually-hidden" for="q">Search</label>
        <input class="input" id="q" type="search" placeholder="Search goals, topics, notes…"
               autocomplete="off" autocapitalize="none" spellcheck="false">
      </div>
      <div id="results"></div>
    </section>`;
}

export function mount(root) {
  const field = $("#q", root);
  const results = $("#results", root);

  const run = () => {
    const query = field.value.trim();
    if (query.length < 2) {
      results.innerHTML = `<p class="empty">Type at least two letters.</p>`;
      return;
    }

    const hits = search(query);
    if (!hits.length) {
      results.innerHTML = `<div class="empty"><p class="empty__title">Nothing found for “${esc(query)}”.</p></div>`;
      return;
    }

    results.innerHTML = `<div class="list">${hits.map(hit => `
      <a class="list__item" href="${hit.route}">
        <span class="list__main">
          <span class="list__title">${esc(hit.title)}</span>
          <span class="list__sub">${esc(hit.subtitle || "")}</span>
        </span>
        <span class="list__side">${esc(hit.kind)}</span>
      </a>`).join("")}</div>`;
  };

  const debounced = debounce(run, 140);
  field.addEventListener("input", debounced);
  run();

  /* Following a result should leave the query behind, not the results. */
  on(results, ".list__item", "click", () => { field.value = ""; });
}
