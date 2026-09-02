#!/usr/bin/env tsx
/**
 * Phase 0 CLI. There is no server, no database and no authentication: a corpus case goes
 * in, a working paper and a run manifest come out (07 §7.1, §7.16).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Command } from "commander";
import { loadPack, packStats, REVENUE_PACK_DIR } from "@audit/methodology";
import { EngineContext, runCase, renderWorkingPaper, AnthropicLlmClient, MockLlmClient } from "@audit/engine";
import { loadCase, loadCorpus, scoreCase, summarise, hardFails } from "@audit/evals";

const program = new Command();
program.name("engine").description("Revenue Audit Intelligence Engine — Phase 0").version("0.1.0");

function llmFor(mock: boolean) {
  if (!mock) return new AnthropicLlmClient();
  // Empty but schema-valid output: exercises ingest → coverage → follow-ups → assemble →
  // render without a model call. Proves the plumbing, never the audit quality.
  return new MockLlmClient(() => ({ facts: [], blocks: [], steps: [], risks: [], controls: [], gaps: [] }));
}

program
  .command("pack")
  .description("validate the methodology pack and print its statistics")
  .option("--dir <dir>", "pack directory", REVENUE_PACK_DIR)
  .action((opts: { dir: string }) => {
    const pack = loadPack(opts.dir);
    const s = packStats(pack);
    console.log(`${pack.pack} v${pack.version} — frameworks: ${pack.frameworks.join(", ")}`);
    console.table(s);
  });

program
  .command("run")
  .description("run one corpus case through the engine")
  .argument("<caseDir>")
  .option("--mock", "use the mock model client (no API key, no audit content)", false)
  .option("--out <dir>", "output directory", "out")
  .option("--pack <dir>", "pack directory", REVENUE_PACK_DIR)
  .action(async (caseDir: string, opts: { mock: boolean; out: string; pack: string }) => {
    const pack = loadPack(opts.pack);
    const c = loadCase(resolve(caseDir));
    const ctx = new EngineContext(
      pack, llmFor(opts.mock), c.meta.caseId, c.meta.engagementId, c.meta.sourceClass, c.meta.clientProfile,
    );
    const wp = await runCase(
      {
        caseId: c.meta.caseId, engagementId: c.meta.engagementId, language: c.meta.language,
        sourceClass: c.meta.sourceClass, format: "plaintext", content: c.transcript,
        clientProfile: c.meta.clientProfile,
      },
      ctx,
    );

    const dir = join(resolve(opts.out), c.meta.caseId, ctx.runId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "workingpaper.json"), JSON.stringify(wp, null, 2));
    writeFileSync(join(dir, "run.json"), JSON.stringify(ctx.manifest(), null, 2));
    writeFileSync(join(dir, "workingpaper.html"), renderWorkingPaper(wp, { documentLabel: "Working paper" }));

    const m = ctx.manifest();
    console.log(`${c.meta.caseId}  coverage ${wp.coverage.coveragePct}%  risks ${wp.risks.length}  controls ${wp.controls.length}  gaps ${wp.gaps.length}`);
    console.log(`  open items ${wp.openItems.length} (mandatory ${wp.openItems.filter((o) => o.priority === "mandatory").length})`);
    console.log(`  grounding ${wp.grounding.grounded}/${wp.grounding.total} integrityOk=${wp.grounding.integrityOk}`);
    console.log(`  cost $${m.totalCostUsd.toFixed(3)}  ${(m.totalLatencyMs / 1000).toFixed(1)}s  →  ${dir}`);
  });

program
  .command("eval")
  .description("run a corpus set and score it against the answer keys")
  .option("--corpus <dir>", "corpus root", "corpus/synthetic")
  .option("--set <set>", "dev | test", "dev")
  .option("--mock", "use the mock model client", false)
  .option("--pack <dir>", "pack directory", REVENUE_PACK_DIR)
  .action(async (opts: { corpus: string; set: "dev" | "test"; mock: boolean; pack: string }) => {
    const pack = loadPack(opts.pack);
    const cases = loadCorpus(resolve(opts.corpus), opts.set);
    if (cases.length === 0) {
      console.error(`No cases found in ${opts.corpus} for set "${opts.set}".`);
      process.exitCode = 1;
      return;
    }
    const scored = [];
    for (const c of cases) {
      if (!c.answerKey) { console.warn(`skipping ${c.meta.caseId}: no answer key`); continue; }
      const ctx = new EngineContext(
        pack, llmFor(opts.mock), c.meta.caseId, c.meta.engagementId, c.meta.sourceClass, c.meta.clientProfile,
      );
      const wp = await runCase(
        {
          caseId: c.meta.caseId, engagementId: c.meta.engagementId, language: c.meta.language,
          sourceClass: c.meta.sourceClass, format: "plaintext", content: c.transcript,
          clientProfile: c.meta.clientProfile,
        },
        ctx,
      );
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
      process.exitCode = 1;
    }
  });

await program.parseAsync();
