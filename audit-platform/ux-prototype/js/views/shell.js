/* The entire permanent frame: one identity line and one stage spine. 64px.
   There is no sidebar, no breadcrumb and no tab bar. */

import { esc, cx, act as btn } from "../ui.js";
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

export const engContext = () => `
  <button class="idline__who" data-act="palette-eng">${esc(client.short)}</button>
  <span class="idline__sep">/</span>
  <span>Revenue</span>
  <span class="idline__sep">·</span>
  <span>FY2026 interim</span>`;

export function spine(active) {
  return `<nav class="spine">
    ${st.stages().map((s) => `
      <button class="${cx("stage", s.id === active && "is-on")}" data-act="nav" data-href="${s.href}">
        <span class="stage__n">${esc(s.name)}</span>
        <span class="${cx("stage__c", s.tone && "stage__c--" + s.tone)}">${esc(s.count)}</span>
      </button>`).join("")}
    <span class="spine__sp"></span>
  </nav>`;
}

/** Standard engagement screen: frame + scrolling canvas. */
export const screen = (stage, body, o = {}) =>
  `${idline(engContext())}${spine(stage)}
   <div class="canvas">${o.raw ? body : `<div class="${cx("wrap", o.width && "wrap--" + o.width)}">${body}</div>`}</div>`;
