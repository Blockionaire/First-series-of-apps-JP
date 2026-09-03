#!/usr/bin/env node
/**
 * Phase 0 CLI. No server, no database, no authentication: a corpus case goes in, a working
 * paper and a run manifest come out (07 §7.1, §7.16).
 *
 * Argument parsing uses Node's built-in `util.parseArgs` — three subcommands do not justify
 * a dependency (08 §E).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadPack, packStats, REVENUE_PACK_DIR } from "@audit/methodology";
import { EngineContext, runCase, renderWorkingPaper, AnthropicLlmClient, MockLlmClient } from "@audit/engine";
import { loadCase, loadCorpus, scoreCase, summarise, hardFails } from "@audit/evals";
import type { CorpusCase } from "@audit/evals";

const USAGE = `engine — Revenue Audit Intelligence Engine (Phase 0)

  engine pack [--pack <dir>]
      Validate the methodology pack and print its statistics.

  engine run <caseDir> [--mock] [--out <dir>] [--pack <dir>]
      Run one corpus case. --mock uses the mock client: proves the plumbing, not the
      audit content, and needs no API key.

  engine eval [--corpus <dir>] [--set dev|test] [--mock] [--pack <dir>]
      Run a corpus set and score it against the answer keys.
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    mock: { type: "boolean", default: false },
    out: { type: "string", default: "out" },
    pack: { type: "string", default: REVENUE_PACK_DIR },
    corpus: { type: "string", default: "corpus/synthetic" },
    set: { type: "string", default: "dev" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const command = positionals[0];
if (values.help || !command) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

function llmFor(mock: boolean) {
  if (!mock) return new AnthropicLlmClient();
  // Schema-valid but empty: exercises ingest → coverage → follow-ups → assemble → render
  // without a model call.
  return new MockLlmClient(() => ({ facts: [], blocks: [], steps: [], risks: [], controls: [], gaps: [] }));
}

async function runOne(c: CorpusCase, pack: ReturnType<typeof loadPack>) {
  const ctx = new EngineContext(
    pack, llmFor(values.mock), c.meta.caseId, c.meta.engagementId, c.meta.sourceClass, c.meta.clientProfile,
  );
  const wp = await runCase(
    {
      caseId: c.meta.caseId, engagementId: c.meta.engagementId, language: c.meta.language,
      sourceClass: c.meta.sourceClass, format: "plaintext", content: c.transcript,
      clientProfile: c.meta.clientProfile,
    },
    ctx,
  );
  return { wp, ctx };
}

switch (command) {
  case "pack": {
    const pack = loadPack(values.pack);
    console.log(`${pack.pack} v${pack.version} — frameworks: ${pack.frameworks.join(", ")}`);
    console.table(packStats(pack));
    break;
  }

  case "run": {
    const caseDir = positionals[1];
    if (!caseDir) { console.error("engine run <caseDir>"); process.exit(1); }
    const pack = loadPack(values.pack);
    const c = loadCase(resolve(caseDir));
    const { wp, ctx } = await runOne(c, pack);

    const dir = join(resolve(values.out), c.meta.caseId, ctx.runId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "workingpaper.json"), JSON.stringify(wp, null, 2));
    writeFileSync(join(dir, "run.json"), JSON.stringify(ctx.manifest(), null, 2));
    writeFileSync(join(dir, "workingpaper.html"), renderWorkingPaper(wp, { documentLabel: "Working paper" }));

    const m = ctx.manifest();
    console.log(`${c.meta.caseId}  coverage ${wp.coverage.coveragePct}%  risks ${wp.risks.length}  controls ${wp.controls.length}  gaps ${wp.gaps.length}`);
    console.log(`  open items ${wp.openItems.length} (mandatory ${wp.openItems.filter((o) => o.priority === "mandatory").length})`);
    console.log(`  grounding ${wp.grounding.grounded}/${wp.grounding.total} integrityOk=${wp.grounding.integrityOk}`);
    console.log(`  cost $${m.totalCostUsd.toFixed(3)}  ${(m.totalLatencyMs / 1000).toFixed(1)}s  →  ${dir}`);
    break;
  }

  case "eval": {
    const pack = loadPack(values.pack);
    const set = values.set === "test" ? "test" : "dev";
    const cases = loadCorpus(resolve(values.corpus), set);
    if (cases.length === 0) {
      console.error(`No cases found in ${values.corpus} for set "${set}".`);
      process.exit(1);
    }
    const scored = [];
    for (const c of cases) {
      if (!c.answerKey) { console.warn(`skipping ${c.meta.caseId}: no answer key`); continue; }
      const { wp } = await runOne(c, pack);
      scored.push(scoreCase({
        caseId: c.meta.caseId, key: c.answerKey, risks: wp.risks, controls: wp.controls,
        coverage: wp.coverage, missing: wp.openItems, grounding: wp.grounding,
      }));
    }
    console.table(scored);
    console.log(summarise(scored));
    const fails = hardFails(scored);
    if (fails.length) {
      console.error("\nHARD FAILS:\n  - " + fails.join("\n  - "));
      process.exit(1);
    }
    break;
  }

  default:
    console.error(`Unknown command "${command}"\n\n${USAGE}`);
    process.exit(1);
}
