/* The permanent frame: one identity line and one process journey.

   The journey is not a tab bar. It is ordered, each step carries its own state,
   and a step that has not started says why. */

import { esc, cx } from "../ui.js";
import { client, user } from "../data-sources.js";
import * as st from "../state.js";

export function idline(context) {
  return `<header class="idline">
    ${context || `<span class="idline__who">${esc(user.name)}</span>`}
    <span class="idline__sp"></span>
    ${st.S.generated ? `<span class="idline__saved">Saved</span>` : ""}
    <button class="kbd" data-act="palette" title="Search and commands">⌘K</button>
    <button class="kbd" data-act="keys" title="Keyboard shortcuts">?</button>
  </header>`;
}

/** Client / FY / Interim / Revenue — each segment navigates up a layer. */
export const engContext = () => `
  <button class="idline__who" data-act="nav" data-href="#/engagement">${esc(client.short)}</button>
  <span class="idline__sep">/</span>
  <button class="idline__seg" data-act="nav" data-href="#/engagement">FY2026</button>
  <span class="idline__sep">/</span>
  <button class="idline__seg" data-act="nav" data-href="#/engagement">Interim</button>
  <span class="idline__sep">/</span>
  <button class="idline__seg is-here" data-act="nav" data-href="#/revenue">Revenue</button>`;

export function journeyBar(active) {
  const steps = st.journeyStates();
  return `<nav class="journey">
    ${steps.map((j, i) => `
      ${i ? `<span class="journey__link"></span>` : ""}
      <button class="${cx("jstep", `is-${j.s}`, j.id === active && "is-on")}"
        data-act="nav" data-href="${esc(j.href)}"
        ${j.why ? `title="${esc(j.why)}"` : ""}>
        <span class="jstep__n">${esc(j.name)}</span>
        <span class="${cx("jstep__c", j.tone && "jstep__c--" + j.tone)}">${esc(j.c)}</span>
      </button>`).join("")}
    <span class="journey__sp"></span>
  </nav>`;
}

/** Standard process-workspace screen. */
export const screen = (step, body, o = {}) =>
  `${idline(engContext())}${journeyBar(step)}
   <div class="canvas">${o.raw ? body : `<div class="${cx("wrap", o.width && "wrap--" + o.width)}">${body}</div>`}</div>`;

/** A screen inside the engagement layer — no journey bar. */
export const engScreen = (body, o = {}) =>
  `${idline(engContext())}
   <div class="canvas"><div class="${cx("wrap", o.width && "wrap--" + o.width)}">${body}</div></div>`;
