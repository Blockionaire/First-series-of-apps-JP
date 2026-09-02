import type { WorkingPaper } from "@audit/domain";

/**
 * The neutral working-paper template (07 §7.7).
 *
 * Format blinding is a requirement of the experiment, not a nicety: the firm's own paper is
 * re-rendered through this same function so that raters score content, not typography. So
 * this template must carry NO signal of origin — no "AI-generated" heading, no confidence
 * language, no distinctive section order.
 */
export interface RenderOptions {
  /** Documents are labelled 1/2/3 in the blind test; never by origin. */
  documentLabel?: string;
  /** Set false when rendering the firm's own paper, which has no machine provenance. */
  includeProvenanceAppendix?: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderWorkingPaper(wp: WorkingPaper, opts: RenderOptions = {}): string {
  const label = opts.documentLabel ?? "Working paper";
  const flagged = new Set(wp.grounding.needsSource.map((n) => n.objectId));
  const flag = (id: string) => (flagged.has(id) ? ` <span class="flag">[needs source]</span>` : "");

  const rows = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(label)}</title>
<style>
 body{font:14px/1.55 Georgia,serif;max-width:52em;margin:3em auto;padding:0 1.5em;color:#111}
 h1{font-size:22px;margin:0 0 .2em} h2{font-size:17px;margin:2em 0 .4em;border-bottom:1px solid #ccc;padding-bottom:.2em}
 h3{font-size:14px;margin:1.4em 0 .3em} .meta{color:#555;font-size:12px;margin-bottom:2em}
 table{border-collapse:collapse;width:100%;font-size:12.5px;margin:.6em 0}
 th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
 th{background:#f2f2f2;font-weight:600}
 .flag{color:#8a1c00;font-weight:600;font-size:11px}
 .open{background:#fbf6e8;border-left:3px solid #b8892b;padding:.6em .9em;margin:.6em 0;font-size:12.5px}
 ol.flow{padding-left:1.4em} ol.flow li{margin:.25em 0}
 .app{font-size:11.5px;color:#444}
</style></head><body>
<h1>Revenue — process understanding</h1>
<div class="meta">${esc(label)} · prepared ${esc(wp.generatedAt.slice(0, 10))} · coverage ${wp.coverage.coveragePct}% of applicable items</div>

<h2>1. Process narrative</h2>
${wp.narrative
  .map(
    (b) => `<h3>${esc(b.subProcess)} — ${esc(b.heading)}${flag(b.id)}</h3><p>${esc(b.body)}</p>${
      b.openPoints.length
        ? `<div class="open"><strong>Not obtained:</strong><ul>${b.openPoints.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`
        : ""
    }`,
  )
  .join("\n")}

<h2>2. Flow of transactions</h2>
<ol class="flow">${wp.flow
    .map((s) => `<li>${esc(s.actor)}${s.system ? ` (${esc(s.system)})` : ""}: ${esc(s.action)}${s.isDecision ? " <em>[decision]</em>" : ""}${flag(s.id)}</li>`)
    .join("")}</ol>

<h2>3. Risks of material misstatement</h2>
<table><thead><tr><th>Ref</th><th>Risk</th><th>Assertions</th><th>Factors</th><th>Rating</th><th>Drivers</th></tr></thead><tbody>
${wp.risks
  .map((r) =>
    rows([
      esc(r.libraryRef ?? "new"),
      `${esc(r.title)}${r.fraudRelated ? " <em>(fraud-related)</em>" : ""}${flag(r.id)}`,
      esc(r.assertions.join(", ")),
      esc(r.inherentRiskFactors.join(", ")),
      esc(r.inherentRiskRating),
      esc(r.drivers.join("; ")),
    ]),
  )
  .join("\n")}
</tbody></table>

<h2>4. Controls identified</h2>
<table><thead><tr><th>Ref</th><th>Control</th><th>Type / nature / frequency</th><th>Owner</th><th>Information relied on</th><th>Evidence of operation</th></tr></thead><tbody>
${wp.controls
  .map((c) =>
    rows([
      esc(c.libraryRef ?? "new"),
      `${esc(c.title)}${c.keyControlCandidate ? " <em>(proposed key control)</em>" : ""}${flag(c.id)}`,
      esc(`${c.controlType} / ${c.controlNature} / ${c.frequency}`),
      esc(c.ownerRole ?? "—"),
      esc(c.ipeUsed ?? "—"),
      esc(c.evidenceOfOperation ?? "—"),
    ]),
  )
  .join("\n")}
</tbody></table>

<h2>5. Gaps and matters for follow-up</h2>
<table><thead><tr><th>Type</th><th>Gap</th><th>Potential impact</th></tr></thead><tbody>
${wp.gaps.map((g) => rows([esc(g.gapType.replace(/_/g, " ")), `${esc(g.description)}${flag(g.id)}`, esc(g.potentialImpact)])).join("\n")}
</tbody></table>

<h2>6. Outstanding questions</h2>
<table><thead><tr><th>Priority</th><th>Item</th><th>Question</th></tr></thead><tbody>
${wp.openItems.map((m) => rows([esc(m.priority), esc(m.coverageItemId), esc(m.question)])).join("\n")}
</tbody></table>

${
  opts.includeProvenanceAppendix === false
    ? ""
    : `<h2>Appendix — sources</h2><div class="app"><table><thead><tr><th>Item</th><th>Quote</th><th>Source</th></tr></thead><tbody>
${wp.provenanceIndex
  .flatMap((p) =>
    p.refs.map((r) =>
      rows([
        esc(p.kind),
        esc(r.quote),
        esc(r.locator.kind === "transcript" ? r.locator.segmentId : r.locator.kind),
      ]),
    ),
  )
  .join("\n")}
</tbody></table></div>`
}
</body></html>`;
}
