/* The Process Understanding Map.

   One diagram, three meanings: what happens (step 3), what controls it and what
   is wrong with it (step 4), and whether a real transaction behaved that way
   (step 5). The same nodes gain annotation as the process work advances. */

import { esc, cx, act as btn, chip, evidence } from "../ui.js";
import { processSteps } from "../data-process.js";
import { controls } from "../data-model.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";

const S = st.S;

/** mode: "plain" (step 3) · "annotated" (step 4) · "trace" (step 5) */
export function processMap(mode = "annotated", opts = {}) {
  const { selected = null, onSelect = "map-node", compact = false } = opts;
  const findings = st.allFindings();

  const node = (p, i) => {
    const ctl = p.controls.length;
    const fnd = findings.filter((f) => f.step === p.id);
    const t = mode === "trace" ? st.traceStepFor(p.id) : null;
    const verdict = t ? st.traceVerdict(t) : null;
    const na = mode === "trace" && !t;

    let markers = "";
    if (mode === "trace") {
      markers = na
        ? `<span class="mapnode__na">not traced</span>`
        : verdict === "corroborated" ? `<span class="mapnode__v mapnode__v--ok">✓ corroborated</span>`
        : verdict === "exception" ? `<span class="mapnode__v mapnode__v--ex">! exception</span>`
        : `<span class="mapnode__v">awaiting</span>`;
    } else if (mode === "annotated") {
      markers = `<span class="mapnode__m">
        ${ctl ? `<span class="mapnode__ctl" title="${ctl} control${ctl === 1 ? "" : "s"}">${"◆".repeat(Math.min(ctl, 3))}</span>` : `<span class="mapnode__none">no control</span>`}
        ${fnd.length ? `<span class="mapnode__f">● ${fnd.length}</span>` : ""}
        ${p.contested ? `<span class="mapnode__f mapnode__f--alert">● contested</span>` : ""}
      </span>`;
    }

    return `<button class="${cx("mapnode",
        selected === p.id && "is-sel",
        mode === "trace" && verdict === "exception" && "is-ex",
        mode === "trace" && verdict === "corroborated" && "is-ok",
        mode === "trace" && na && "is-na",
        mode === "annotated" && !ctl && "is-uncontrolled")}"
      data-act="${esc(onSelect)}" data-step="${esc(p.id)}">
      <span class="mapnode__i">${i + 1}</span>
      <span class="mapnode__t">${esc(p.name)}</span>
      <span class="mapnode__a">${esc(p.actor)}</span>
      ${compact ? "" : markers}
    </button>`;
  };

  return `<div class="map">
    ${processSteps.map((p, i) => `${i ? `<span class="mapedge"></span>` : ""}${node(p, i)}`).join("")}
  </div>`;
}

export const mapLegend = (mode = "annotated") => mode === "plain" ? "" : mode === "trace"
  ? `<div class="maplegend">
      <span><i class="dot dot--ok"></i>corroborated</span>
      <span><i class="dot dot--alert"></i>exception</span>
      <span><i class="dot dot--open"></i>awaiting</span>
    </div>`
  : `<div class="maplegend">
      <span><b>◆</b> control identified</span>
      <span><i class="dot dot--warn"></i>finding on this step</span>
      <span><i class="dot dot--open"></i>no control identified</span>
    </div>`;

/** The panel that opens under the map when a step is clicked. */
export function mapDetail(stepId) {
  const p = processSteps.find((x) => x.id === stepId);
  if (!p) return "";
  const ctl = controls.filter((c) => p.controls.includes(c.id));
  const fnd = st.allFindings().filter((f) => f.step === p.id);
  const refs = p.refs.map(ref).filter(Boolean);
  const t = st.traceStepFor(p.id);

  return `<div class="mapdetail">
    <div class="row" style="align-items:baseline;gap:12px;margin-bottom:8px">
      <span class="t-h">${esc(p.name)}</span>
      <span class="t-meta">${esc(p.actor)} · ${esc(p.system)}</span>
      <span class="sp"></span>
      <button class="b-act b-act--plain b-act--sm" data-act="map-node" data-step="">Close</button>
    </div>
    <p class="t-sub" style="max-width:70ch;line-height:1.6">${esc(p.what)}</p>

    <div class="grid2" style="margin-top:20px">
      <div>
        <div class="t-eyebrow" style="margin-bottom:8px">Controls</div>
        ${ctl.length ? ctl.map((c) => {
          const d = st.controlDecision(c);
          return `<div class="rw" style="padding:10px 0">
            <span class="rw__main">
              <span class="rw__t" style="font-size:14px">${esc(c.title)}</span>
              <span class="rw__d">${esc(c.owner || "owner not established")} · ${
                d === "key" ? "key control" : d === "not_key" ? "not key" : d === "undecided" ? "undecided" : "not concluded"}</span>
            </span></div>`;
        }).join("") : `<p class="t-sub" style="color:var(--warn)">No control identified on this step.</p>`}
      </div>
      <div>
        <div class="t-eyebrow" style="margin-bottom:8px">Findings</div>
        ${fnd.length ? fnd.map((f) => `<div class="rw" style="padding:10px 0">
          <span class="rw__lead"><i class="dot dot--${f.severity === "observation" ? "warn" : "alert"}"></i></span>
          <span class="rw__main"><span class="rw__t" style="font-size:14px">${esc(f.title)}</span>
          ${f.fromTrace ? `<span class="rw__d">Raised by the line walkthrough</span>` : ""}</span>
        </div>`).join("") : `<p class="t-sub">None recorded on this step.</p>`}
      </div>
    </div>

    ${t && st.traceVerdict(t) ? `<div style="margin-top:18px">
      <div class="t-eyebrow" style="margin-bottom:8px">On the traced transaction</div>
      <p class="t-sub" style="max-width:70ch;line-height:1.6">${esc(t.observation)}</p>
    </div>` : ""}

    <div style="margin-top:18px">
      <div class="t-eyebrow" style="margin-bottom:8px">Established from</div>
      ${evidence(refs)}
    </div>
  </div>`;
}
