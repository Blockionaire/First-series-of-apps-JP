/* The Process Understanding Map.

   One diagram, three meanings: what happens (step 3), what controls it and what
   is wrong with it (step 4), and whether a real transaction behaved that way
   (step 5). The same nodes gain annotation as the process work advances.

   Revenue is not a single line. Machine sales and spare part sales share a
   spine and diverge at installation; service contracts run a different path
   entirely; all three converge at revenue posting. The map is drawn from the
   `variants` and `next` fields on the steps, so the picture and the model
   cannot drift apart. */

import { esc, cx, act as btn, chip, evidence } from "../ui.js";
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
        <div class="maplane__l">${esc(g.label)}</div>
        ${strip(g.steps, g.variants, true)}
      </div>`).join("")}
    </div>
    ${merge.length ? `<div class="maplane maplane--merge">
      <div class="maplane__l">All variants converge here</div>
      ${strip(merge, ALL, true)}
    </div>` : ""}
  </div>`;
}

export const mapLegend = (mode = "annotated") => mode === "plain" ? "" : mode === "trace"
  ? `<div class="maplegend">
      <span><i class="dot dot--ok"></i>corroborated</span>
      <span><i class="dot dot--alert"></i>exception</span>
      <span><i class="dot dot--open"></i>awaiting</span>
      <span style="opacity:.6">faded — not on this transaction's path</span>
    </div>`
  : `<div class="maplegend">
      <span><b>◆</b> control identified</span>
      <span><i class="dot dot--warn"></i>finding on this step</span>
      <span><i class="dot dot--open"></i>no control identified</span>
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
    <div class="row" style="align-items:baseline;gap:12px;margin-bottom:8px">
      <span class="t-h">${esc(p.name)}</span>
      <span class="t-meta">${esc(p.actor)} · ${esc(p.system)}</span>
      <span class="sp"></span>
      <button class="b-act b-act--plain b-act--sm" data-act="map-node" data-step="">Close</button>
    </div>
    <p class="t-sub" style="max-width:70ch;line-height:1.6">${esc(p.what)}</p>
    <p class="t-meta" style="margin-top:8px">On ${esc(onVariants.join(", "))}${
      p.skipNote ? ` · ${esc(p.skipNote)}` : ""}</p>

    <div class="grid2" style="margin-top:20px">
      <div>
        <div class="t-eyebrow" style="margin-bottom:8px">Controls</div>
        ${ctl.length ? ctl.map((c) => {
          const d = st.controlDecision(c);
          return `<div class="rw" style="padding:10px 0">
            <span class="rw__main">
              <span class="rw__t" style="font-size:14px">${esc(c.title)}</span>
              <span class="rw__d">${esc(c.owner || "owner not established")} · ${
                d === "key" ? "key control" : d === "not_key" ? "not key"
                : d === "carried_forward" ? "carried forward undecided"
                : d === "undecided" ? "parked, not concluded" : "not concluded"}</span>
            </span></div>`;
        }).join("") : `<p class="t-sub" style="color:var(--warn)">No control identified on this step.</p>`}
      </div>
      <div>
        <div class="t-eyebrow" style="margin-bottom:8px">Findings</div>
        ${fnd.length ? fnd.map((f) => {
          const o = st.findingOutcome(f);
          return `<div class="rw" style="padding:10px 0">
            <span class="rw__lead"><i class="dot dot--${o.severity === "observation" ? "warn" : "alert"}"></i></span>
            <span class="rw__main"><span class="rw__t" style="font-size:14px">${esc(o.title)}</span>
            <span class="rw__d">${f.fromTrace ? "Raised by the line walkthrough · " : ""}${
              o.decision === "dismissed" ? "dismissed" : o.decision ? "concluded" : "not concluded"}</span></span>
          </div>`;
        }).join("") : `<p class="t-sub">None recorded on this step.</p>`}
      </div>
    </div>

    ${ts && st.traceVerdict(txn, ts) ? `<div style="margin-top:18px">
      <div class="t-eyebrow" style="margin-bottom:8px">On the traced transaction</div>
      <p class="t-sub" style="max-width:70ch;line-height:1.6">${esc(ts.observation)}</p>
    </div>` : ""}
    ${!ts && skip ? `<div style="margin-top:18px">
      <div class="t-eyebrow" style="margin-bottom:8px">Not traced on this transaction</div>
      <p class="t-sub" style="max-width:70ch;line-height:1.6">${esc(skip.why)}</p>
    </div>` : ""}

    <div style="margin-top:18px">
      <div class="t-eyebrow" style="margin-bottom:8px">Established from</div>
      ${evidence(refs)}
    </div>
  </div>`;
}
