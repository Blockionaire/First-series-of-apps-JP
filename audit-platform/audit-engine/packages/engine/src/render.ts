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

/** The single neutral shell. Variants A, B and C all pass through it — that is the point. */
export function SHELL(label: string, body: string, title: string): string {
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
<h1>${esc(title)}</h1>
<div class="meta">${esc(label)}</div>
${body}
</body></html>`;
}

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


/* ── Variant A, and blinding hygiene ──────────────────────────────────────── */

/**
 * Re-render a document that did not come from the engine — in practice the firm's own
 * working paper — through the *same* shell as variant B and C.
 *
 * Format blinding is a requirement of the experiment (07 §7.7): if variant A arrives in the
 * firm's own typography, raters score the typography. Input is markdown-lite: `## Heading`,
 * blank-line-separated paragraphs, and simple pipe tables.
 */
export function renderNeutralDocument(source: string, opts: RenderOptions = {}): string {
  const label = opts.documentLabel ?? "Working paper";
  const blocks: string[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let table: string[][] = [];

  const flushPara = () => {
    if (para.length) blocks.push(`<p>${esc(para.join(" "))}</p>`);
    para = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const [head, ...rest] = table;
    const body = rest.filter((r) => !r.every((c) => /^-{2,}$/.test(c.trim())));
    blocks.push(
      `<table><thead><tr>${head!.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
        body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") +
        `</tbody></table>`,
    );
    table = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara();
      table.push(line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    } else if (/^##\s+/.test(line)) {
      flushPara(); flushTable();
      blocks.push(`<h2>${esc(line.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^###\s+/.test(line)) {
      flushPara(); flushTable();
      blocks.push(`<h3>${esc(line.replace(/^###\s+/, ""))}</h3>`);
    } else if (line.trim() === "") {
      flushPara(); flushTable();
    } else {
      flushTable();
      para.push(line.trim());
    }
  }
  flushPara(); flushTable();

  return SHELL(label, blocks.join("\n"), "Revenue — process understanding");
}

/**
 * Scan a rendered document for anything that identifies its origin before the blind test
 * runs. Raters who can spot the AI document score their prior, not the content, and the
 * blinding-integrity check would then fail after the effort has been spent.
 */
const TELLS: { pattern: RegExp; why: string }[] = [
  { pattern: /\bAI\b|artificial intelligence/i, why: "names AI" },
  // Deliberately conservative: bare "model" is ordinary audit vocabulary — the IFRS 15
  // five-step model, the expected credit loss model — and matching it would make the
  // scanner noisy enough to be ignored, which is worse than not having it.
  { pattern: /\bClaude\b|anthropic|\bGPT\b|language model|\bLLM\b/i, why: "names the model or vendor" },
  { pattern: /\bgenerated\b|auto-generated|machine-generated/i, why: "says generated" },
  { pattern: /confidence (score|level)|\b\d{1,3}% confiden/i, why: "confidence language" },
  { pattern: /as an? (assistant|model)|I (cannot|can't|am unable)/i, why: "assistant register" },
  { pattern: /it appears that|it seems likely|may possibly|might potentially/i, why: "hedging register" },
  { pattern: /\bprompt\b|\btoken(s)?\b|\bpipeline\b/i, why: "implementation vocabulary" },
];

export interface Tell { why: string; excerpt: string }

export function scanForTells(html: string): Tell[] {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const found: Tell[] = [];
  for (const { pattern, why } of TELLS) {
    const m = text.match(pattern);
    if (m && m.index !== undefined) {
      found.push({ why, excerpt: text.slice(Math.max(0, m.index - 40), m.index + 60).trim() });
    }
  }
  return found;
}
