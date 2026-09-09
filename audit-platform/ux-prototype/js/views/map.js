/* The Process Understanding Map.

   One diagram, three meanings: what happens (step 3), what controls it and what
   is wrong with it (step 4), and whether a real transaction behaved that way
   (step 5). The same nodes gain annotation as the process work advances.

   Revenue is not a single line. Machine sales and spare part sales share a
   spine and diverge at installation; service contracts run a different path
   entirely; all three converge at revenue posting. The map is drawn from the
   `variants` and `next` fields on the steps, so the picture and the model
   cannot drift apart. */

import { esc, cx, act as btn, chip, tag, icon, evidence } from "../ui.js";
import { processSteps, variants, stepsForVariant, txnById } from "../data-process.js";
import { controls } from "../data-model.js";
import { ref } from "../data-sources.js";
import * as st from "../state.js";

const S = st.S;
const ALL = variants.map((v) => v.id);

/** Steps every variant passes through — where the flows converge. */
const isMerge = (p) => ALL.every((v) => p.variants.includes(v));

/** The lanes, derived from the step data rather than declared. */
function lanes() {
  const merge = processSteps.filter(isMerge);
  const rest = processSteps.filter((p) => !isMerge(p));
  const groups = [];
  rest.forEach((p) => {
    const g = groups.find((x) => x.variants.some((v) => p.variants.includes(v)));
    if (g) { g.steps.push(p); p.variants.forEach((v) => { if (!g.variants.includes(v)) g.variants.push(v); }); }
    else groups.push({ variants: [...p.variants], steps: [p] });
  });
  groups.forEach((g) => {
    g.label = g.variants.map((v) => variants.find((x) => x.id === v)?.short || v).join(" and ");
  });
  return { groups, merge };
}

/** "Machine sales only" — said in words, on a step that is not on every path. */
function variantNote(p, laneVariants) {
  const missing = laneVariants.filter((v) => !p.variants.includes(v));
  if (!missing.length) return "";
  const names = p.variants
    .filter((v) => laneVariants.includes(v))
    .map((v) => variants.find((x) => x.id === v)?.short || v);
  return `${names.join(" and ")} only`;
}

/** mode: "plain" (step 3) · "annotated" (step 4) · "trace" (step 5) */
export function processMap(mode = "annotated", opts = {}) {
  const { selected = null, onSelect = "map-node", compact = false,
          variant = null, txn = null } = opts;
  const findings = st.allFindings();
  const t = txn ? txnById(txn) : null;
  const untraced = (id) => (t?.untraced || []).find((u) => u.step === id) || null;

  const node = (p, i, laneVariants) => {
    const ctl = p.controls.length;
    const fnd = findings.filter((f) => f.step === p.id && st.findingOutcome(f).decision !== "dismissed");
    const ts = txn ? st.traceStepFor(txn, p.id) : null;
    const verdict = ts ? st.traceVerdict(txn, ts) : null;
    const skip = untraced(p.id);
    const offPath = mode === "trace" && t && !ts;
    const vnote = variantNote(p, laneVariants);

    let markers = "";
    if (mode === "trace") {
      // Three different things, never collapsed into one: this step is not on
      // the variant's path at all; it is on the path but has not happened yet;
      // or it is on the path and simply has not been traced.
      const offVariant = t && !p.variants.includes(t.variant);
      markers = offPath
        ? `<span class="mapnode__na">${esc(offVariant ? "not in this variant"
            : skip ? (skip.kind === "not_applicable" ? "not in this variant" : "not yet occurred")
            : "not traced")}</span>`
        : verdict === "corroborated" ? `<span class="mapnode__v mapnode__v--ok">${icon("check", 13)}corroborated</span>`
        : verdict === "exception" ? `<span class="mapnode__v mapnode__v--ex">${icon("contradiction", 13)}exception</span>`
        : `<span class="mapnode__v">${icon("clock", 13)}awaiting</span>`;
    } else if (mode === "annotated") {
      markers = `<span class="mapnode__m">
        ${ctl ? `<span class="mapnode__ctl" title="${ctl} control${ctl === 1 ? "" : "s"}">${
            icon("control", 13)}${ctl}</span>`
          : `<span class="mapnode__none">${icon("control", 13)}none</span>`}
        ${fnd.length ? `<span class="mapnode__f">${icon("finding", 13)}${fnd.length}</span>` : ""}
        ${p.contested ? `<span class="mapnode__f mapnode__f--alert">${icon("contradiction", 13)}contested</span>` : ""}
      </span>`;
    }

    return `<button class="${cx("mapnode",
        selected === p.id && "is-sel",
        mode === "trace" && verdict === "exception" && "is-ex",
        mode === "trace" && verdict === "corroborated" && "is-ok",
        offPath && "is-na")}"
      data-act="${esc(onSelect)}" data-step="${esc(p.id)}">
      <span class="mapnode__i">${i}</span>
      <span class="mapnode__t">${esc(p.name)}</span>
      <span class="mapnode__a">${esc(p.actor)}</span>
      ${vnote ? `<span class="mapnode__vr">${esc(vnote)}</span>` : ""}
      ${compact ? "" : markers}
    </button>`;
  };

  /* On a branched map a single running number would be a lie — the paths are
     different lengths. Branched shows the step id; a single variant shows its
     position on that path. */
  const strip = (steps, laneVariants, branched) => `<div class="map">
    ${steps.map((p, i) => `${i ? `<span class="mapedge"></span>` : ""}${
      node(p, branched ? p.id : i + 1, laneVariants)}`).join("")}
  </div>`;

  /* One variant: one path, no branching to draw. */
  if (variant) {
    const steps = stepsForVariant(variant);
    return strip(steps, [variant], false);
  }

  const { groups, merge } = lanes();
  return `<div class="mapg">
    <div class="mapg__lanes">
      ${groups.map((g) => `<div class="maplane">
        <div class="maplane__l">${icon("variant", 13)}${esc(g.label)}</div>
        ${strip(g.steps, g.variants, true)}
      </div>`).join("")}
    </div>
    ${merge.length ? `
    <div class="converge">
      <span class="converge__r"></span>
      <svg class="converge__j" width="96" height="30" viewBox="0 0 96 30" fill="none" aria-hidden="true">
        <path d="M6 0 V8 Q6 16 14 16 H82 Q90 16 90 8 V0" stroke="currentColor" stroke-width="1.25"/>
        <path d="M48 16 V26 M44 22l4 4 4-4" stroke="currentColor" stroke-width="1.25"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="converge__l">All three variants converge</span>
      <span class="converge__r"></span>
    </div>
    <div class="maplane maplane--merge">
      ${strip(merge, ALL, true)}
    </div>` : ""}
  </div>`;
}

export const mapLegend = (mode = "annotated") => mode === "plain" ? "" : mode === "trace"
  ? `<div class="maplegend">
      <span><i class="dot dot--ok"></i>corroborated</span>
      <span><i class="dot dot--alert"></i>exception</span>
      <span><i class="dot dot--open"></i>awaiting</span>
      <span class="ink5">faded — not on this transaction's path</span>
    </div>`
  : `<div class="maplegend">
      <span>${icon("control", 13)}control identified</span>
      <span>${icon("finding", 13)}finding on this step</span>
      <span><i class="dot dot--warn"></i>no control identified</span>
    </div>`;

/** The panel that opens under the map when a step is clicked. */
export function mapDetail(stepId, opts = {}) {
  const { txn = null } = opts;
  const p = processSteps.find((x) => x.id === stepId);
  if (!p) return "";
  const ctl = controls.filter((c) => p.controls.includes(c.id));
  const fnd = st.allFindings().filter((f) => f.step === p.id);
  const refs = p.refs.map(ref).filter(Boolean);
  const ts = txn ? st.traceStepFor(txn, p.id) : null;
  const skip = txn ? (txnById(txn)?.untraced || []).find((u) => u.step === p.id) : null;
  const onVariants = p.variants.map((v) => variants.find((x) => x.id === v)?.name || v);

  return `<div class="mapdetail">
    <div class="row row--base sec__h">
      <span class="t-h">${esc(p.name)}</span>
      <span class="t-meta">${esc(p.actor)} · ${esc(p.system)}</span>
      <span class="sp"></span>
      ${btn("Close", "map-node", { variant: "ghost", size: "sm", data: { step: "" } })}
    </div>
    <p class="t-body measure">${esc(p.what)}</p>
    <p class="t-meta sec__note">On ${esc(onVariants.join(", "))}${
      p.skipNote ? ` · ${esc(p.skipNote)}` : ""}</p>

    <div class="grid2 sec--tight">
      <div>
        <div class="t-eyebrow rail__h">Controls</div>
        ${ctl.length ? ctl.map((c) => {
          const d = st.controlDecision(c);
          return `<div class="dep__i">${icon("control", 15)}
            <span>${esc(c.title)}<span class="t-meta">${esc(c.owner || "owner not established")}</span></span>
            <span class="t-meta">${
                d === "key" ? "key control" : d === "not_key" ? "not key"
                : d === "carried_forward" ? "carried forward" : d === "undecided" ? "parked" : "not concluded"}</span>
          </div>`;
        }).join("") : `<p class="t-sub"><span class="state state--warn"><i class="dot dot--warn"></i>No control identified on this step.</span></p>`}
      </div>
      <div>
        <div class="t-eyebrow rail__h">Findings</div>
        ${fnd.length ? fnd.map((f) => {
          const o = st.findingOutcome(f);
          return `<div class="dep__i">${icon("finding", 15)}
            <span>${esc(o.title)}<span class="t-meta">${f.fromTrace ? "Raised by the line walkthrough" : "From the analysis"}</span></span>
            <span class="t-meta">${o.decision === "dismissed" ? "dismissed" : o.decision ? "concluded" : "open"}</span>
          </div>`;
        }).join("") : `<p class="t-sub">None recorded on this step.</p>`}
      </div>
    </div>

    ${ts && st.traceVerdict(txn, ts) ? `<div class="sec--tight">
      <div class="t-eyebrow rail__h">On the traced transaction</div>
      <p class="t-body measure">${esc(ts.observation)}</p>
    </div>` : ""}
    ${!ts && skip ? `<div class="sec--tight">
      <div class="t-eyebrow rail__h">Not traced on this transaction</div>
      <p class="t-body measure">${esc(skip.why)}</p>
    </div>` : ""}

    <div class="sec--tight">
      <div class="t-eyebrow rail__h">Established from</div>
      ${evidence(refs)}
    </div>
  </div>`;
}
