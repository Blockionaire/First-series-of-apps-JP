/* The permanent frame: a horizontal application header and the process journey.

   No sidebar at any width. Orientation comes from the breadcrumb — client,
   engagement, phase, process — which is always present and always clickable.

   The journey is not a tab bar. It is ordered, connected, each step carries its
   own state, and a step that has not started says why. */

import { esc, cx, icon } from "../ui.js";
import { client, user } from "../data-sources.js";
import * as st from "../state.js";

const initials = (n) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/* --- The wordmark ------------------------------------------------------------
   A ledger rule with a check through it: the file, and the work on it. Drawn
   inline so it needs no asset and survives file://.
   -------------------------------------------------------------------------- */
const wordmark = () => `
  <button class="mark" data-act="nav" data-href="#/" title="Work">
    <svg class="mark__g" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="1.6" y="1.6" width="16.8" height="16.8" rx="5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5.6 10.4l2.8 2.8 6-6.4" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="mark__t">Audit AI</span>
  </button>`;

/** Client › FY › Interim › Revenue — each segment navigates up a layer. */
export function breadcrumb(deep = true) {
  const sep = `<span class="crumb__s">${icon("chevron", 12)}</span>`;
  const seg = (label, href, here) =>
    `<button class="${cx("crumb__i", here && "is-here")}" data-act="nav" data-href="${esc(href)}">${esc(label)}</button>`;
  return `<nav class="crumb" aria-label="Where you are">
    ${seg(client.short, "#/engagement", !deep)}${sep}
    ${seg("FY2026", "#/engagement")}${sep}
    ${seg("Interim", "#/engagement")}${deep ? `${sep}${seg("Revenue", "#/revenue", true)}` : ""}
  </nav>`;
}

/** The application header. One row, four things on the right, no more. */
export function header(crumbs) {
  return `<header class="hdr">
    ${wordmark()}
    ${crumbs === null ? "" : (crumbs || breadcrumb())}
    <div class="hdr__r">
      <span class="saved">${icon("check", 13)}Saved</span>
      <button class="srch" data-act="palette" title="Search and commands">
        ${icon("search", 14)}<span>Search</span><span class="k">⌘K</span></button>
      <button class="iconbtn" data-act="keys" title="Keyboard shortcuts">${icon("keyboard", 17)}</button>
      <span class="avatar" title="${esc(user.name)}">${esc(initials(user.name))}</span>
    </div>
  </header>`;
}

/* --- The process journey ---------------------------------------------------
   Marker, name, state — with a connector that fills behind completed steps, so
   progress reads as a line before a word is read.
   -------------------------------------------------------------------------- */
export function journeyBar(active) {
  const steps = st.journeyStates();
  return `<nav class="jrn" aria-label="Process steps">
    ${steps.map((j, i) => `
      <button class="${cx("jstep", `is-${j.s}`, j.id === active && "is-on")}"
        data-act="nav" data-href="${esc(j.href)}"
        ${j.why ? `title="${esc(j.why)}"` : ""} aria-current="${j.id === active ? "step" : "false"}">
        <span class="jstep__top">
          ${i ? `<span class="${cx("jstep__ln", steps[i - 1].s === "done" && "is-fill")}"></span>` : ""}
          <span class="jstep__m"><i></i></span>
          <span class="jstep__n">${esc(j.name)}</span>
        </span>
        <span class="${cx("jstep__c", j.tone && "jstep__c--" + j.tone)}">${esc(j.c)}</span>
      </button>`).join("")}
  </nav>`;
}

/** Standard process-workspace screen: header, journey, canvas. */
export const screen = (step, body, o = {}) =>
  `${header()}${journeyBar(step)}
   <div class="canvas">${o.raw ? body
     : `<div class="${cx("wrap", o.width && "wrap--" + o.width, "page-in")}">${body}</div>`}</div>`;

/** A screen in the engagement layer — no journey bar. */
export const engScreen = (body, o = {}) =>
  `${header(o.crumbs === null ? null : breadcrumb(false))}
   <div class="canvas"><div class="${cx("wrap", o.width && "wrap--" + o.width, "page-in")}">${body}</div></div>`;

/* Kept for callers that still ask for the old frame pieces. */
export const idline = (ctx) => header(ctx === undefined ? undefined : ctx);
export const engContext = () => breadcrumb(true);
