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
import {
  EngineContext, runCase, renderWorkingPaper, renderNeutralDocument, scanForTells,
  AnthropicLlmClient, MockLlmClient,
} from "@audit/engine";
import {
  loadCase, loadCorpus, scoreCase, summarise, hardFails,
  assignRaters, m1, m2, blindingIntegrity, criterionProfile,
  gateReport, verdictOf, loadManifests, costReport, parseCsv, toCsv,
  SYNTHETIC_WARNING, Rating, BlindingGuess, EditRecord, Rater, BlindCase,
} from "@audit/evals";
import type { CorpusCase, Assignment, EditTimings } from "@audit/evals";
import { readFileSync, existsSync } from "node:fs";

const USAGE = `engine — Revenue Audit Intelligence Engine (Phase 0)

  engine pack [--pack <dir>]
      Validate the methodology pack and print its statistics.

  engine run <caseDir> [--mock] [--out <dir>] [--pack <dir>]
      Run one corpus case. --mock uses the mock client: proves the plumbing, not the
      audit content, and needs no API key.

  engine eval [--corpus <dir>] [--set dev|test] [--mock] [--pack <dir>]
      Run a corpus set and score it against the answer keys.

  engine blind --config <file> [--out <dir>]
      Prepare the blind preference test: rater assignments, randomised label
      mapping, and an empty scoring sheet per rater (07 §7.9).

  engine report [--corpus <dir>] [--set dev|test] [--mock] [--evaluation <dir>]
      The Phase 0 gate report: M1-M6 with separate thresholds and the stop rules.
      Reads ratings.csv, edits.csv and timings.json from the evaluation directory
      when they exist; says "incomplete" until the human evidence is in.

  engine costs [--out <dir>]
      Model cost per pipeline stage and per complete case, from the run manifests.

  engine render-a --input <file.md> [--label "Document 2"] [--out <dir>]
      Re-render the firm's own working paper through the SAME neutral shell as the
      engine's output. Format blinding is a requirement, not a nicety (07 §7.7).

  engine check-blinding <file.html> [<file.html> ...]
      Scan rendered documents for anything that reveals their origin, before raters
      ever see them.
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    mock: { type: "boolean", default: false },
    out: { type: "string", default: "out" },
    pack: { type: "string", default: REVENUE_PACK_DIR },
    corpus: { type: "string", default: "corpus/synthetic" },
    config: { type: "string" },
    input: { type: "string" },
    label: { type: "string" },
    evaluation: { type: "string", default: "evaluation" },
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
    if (cases.some((c) => c.meta.origin === "synthetic")) console.log("\n" + SYNTHETIC_WARNING);
    const fails = hardFails(scored);
    if (fails.length) {
      console.error("\nHARD FAILS:\n  - " + fails.join("\n  - "));
      process.exit(1);
    }
    break;
  }

  case "blind": {
    if (!values.config) { console.error("engine blind --config <file>"); process.exit(1); }
    const cfg = JSON.parse(readFileSync(resolve(values.config), "utf8")) as {
      raters: Rater[]; cases: BlindCase[]; seed?: string; casesPerRater?: number;
    };
    const assignments = assignRaters(cfg.cases, cfg.raters, cfg.seed ?? "phase0", cfg.casesPerRater ?? 3);
    const dir = resolve(values.out, "blind");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "assignments.json"), JSON.stringify(assignments, null, 2));

    for (const rater of cfg.raters) {
      const mine = assignments.filter((a: Assignment) => a.raterId === rater.raterId);
      const rows = mine.flatMap((a: Assignment) =>
        (["1", "2", "3"] as const).map((label) => [
          a.raterId, a.caseId, label, "", "", "", "", "", "", "",
        ]),
      );
      writeFileSync(
        join(dir, `scoring-${rater.raterId}.csv`),
        toCsv(
          ["raterId", "caseId", "label", "rank", "completeness", "auditRelevance",
           "clarity", "conciseness", "traceability", "reviewEffortMinutes"],
          rows,
        ),
      );
    }
    console.log(`${assignments.length} assignments for ${cfg.raters.length} raters over ${cfg.cases.length} cases`);
    console.log(`Each rater sees three documents per case under randomised labels.`);
    console.log(`Written to ${dir}. Do NOT send the assignments file to raters.`);
    break;
  }

  case "report": {
    const pack = loadPack(values.pack);
    const set = values.set === "test" ? "test" : "dev";
    const cases = loadCorpus(resolve(values.corpus), set);
    const scored = [];
    let anySynthetic = false;
    for (const c of cases) {
      if (!c.answerKey) continue;
      if (c.meta.origin === "synthetic") anySynthetic = true;
      const { wp } = await runOne(c, pack);
      scored.push(scoreCase({
        caseId: c.meta.caseId, key: c.answerKey, risks: wp.risks, controls: wp.controls,
        coverage: wp.coverage, missing: wp.openItems, grounding: wp.grounding,
      }));
    }

    const evalDir = resolve(values.evaluation);
    const read = (f: string) => existsSync(join(evalDir, f)) ? readFileSync(join(evalDir, f), "utf8") : null;
    const assignmentsRaw = existsSync(join(resolve(values.out), "blind", "assignments.json"))
      ? JSON.parse(readFileSync(join(resolve(values.out), "blind", "assignments.json"), "utf8")) as Assignment[]
      : null;

    const ratingsCsv = read("ratings.csv");
    const editsCsv = read("edits.csv");
    const timingsJson = read("timings.json");

    const ratings = ratingsCsv && assignmentsRaw
      ? parseCsv(ratingsCsv).filter((r) => r["rank"]).map((r) => Rating.parse({
          raterId: r["raterId"], caseId: r["caseId"], label: r["label"], rank: Number(r["rank"]),
          completeness: Number(r["completeness"]), auditRelevance: Number(r["auditRelevance"]),
          clarity: Number(r["clarity"]), conciseness: Number(r["conciseness"]),
          traceability: Number(r["traceability"]), reviewEffortMinutes: Number(r["reviewEffortMinutes"]),
        }))
      : null;
    const edits = editsCsv
      ? parseCsv(editsCsv).filter((r) => r["category"]).map((r) => EditRecord.parse(r))
      : null;
    const timings = timingsJson ? JSON.parse(timingsJson) as EditTimings : null;
    const guessesCsv = read("blinding-guesses.csv");
    const guesses = guessesCsv && assignmentsRaw
      ? parseCsv(guessesCsv).filter((r) => r["guessedAiLabels"]).map((r) => BlindingGuess.parse({
          raterId: r["raterId"], caseId: r["caseId"],
          guessedAiLabels: (r["guessedAiLabels"] ?? "").split(/[;| ]+/).filter(Boolean),
        }))
      : null;

    const editCaseCount = edits ? new Set(edits.map((e) => e.caseId)).size : 0;
    const report = gateReport({
      metrics: scored,
      m1: ratings && assignmentsRaw ? m1(ratings, assignmentsRaw) : null,
      m2: ratings && assignmentsRaw ? m2(ratings, assignmentsRaw) : null,
      edits: edits ? verdictOf(edits, editCaseCount) : null,
      timings,
      blindingIntegrity: guesses && assignmentsRaw ? blindingIntegrity(guesses, assignmentsRaw) : null,
    });

    console.log(report.lines.join("\n"));
    if (ratings && assignmentsRaw) { console.log(""); console.table(criterionProfile(ratings, assignmentsRaw)); }
    console.log("");
    if (report.hardFails.length) console.log("HARD FAILS:\n  - " + report.hardFails.join("\n  - ") + "\n");
    console.log(`VERDICT: ${report.verdict.toUpperCase()}`);
    if (anySynthetic) console.log("\n" + SYNTHETIC_WARNING);
    if (report.humanEvidenceMissing) {
      console.log("\nThe human evidence is not in yet: no gate decision can be taken from the numbers above.");
    }
    break;
  }

  case "costs": {
    const manifests = loadManifests(resolve(values.out));
    if (manifests.length === 0) { console.log(`No run manifests under ${values.out}.`); break; }
    const r = costReport(manifests);
    console.log(`${r.manifests} runs — total $${r.totalUsd.toFixed(3)}  cache hit rate ${(r.cacheHitRate * 100).toFixed(0)}%`);
    if (r.cacheHitRate < 0.9 && r.totalUsd > 0) {
      console.log("  ! below 90% on suite runs means a silent cache invalidator (06 §6.4)");
    }
    console.log("\nPer stage:"); console.table(r.byStage);
    console.log("Per case:"); console.table(r.byCase);
    break;
  }

  case "render-a": {
    if (!values.input) { console.error("engine render-a --input <file.md>"); process.exit(1); }
    const src = readFileSync(resolve(values.input), "utf8");
    const html = renderNeutralDocument(src, { documentLabel: values.label ?? "Working paper" });
    const dir = resolve(values.out, "blind", "documents");
    mkdirSync(dir, { recursive: true });
    const name = resolve(values.input).split("/").pop()!.replace(/\.[^.]+$/, "") + ".html";
    writeFileSync(join(dir, name), html);
    const tells = scanForTells(html);
    console.log(`Rendered ${join(dir, name)}`);
    if (tells.length) {
      console.log("\n! origin tells found — fix before the blind test:");
      for (const t of tells) console.log(`   ${t.why}: ...${t.excerpt}...`);
      process.exitCode = 1;
    } else console.log("No origin tells found.");
    break;
  }

  case "check-blinding": {
    const files = positionals.slice(1);
    if (files.length === 0) { console.error("engine check-blinding <file.html> ..."); process.exit(1); }
    let bad = 0;
    for (const f of files) {
      const tells = scanForTells(readFileSync(resolve(f), "utf8"));
      if (tells.length === 0) console.log(`ok    ${f}`);
      else {
        bad++;
        console.log(`TELLS ${f}`);
        for (const t of tells) console.log(`        ${t.why}: ...${t.excerpt}...`);
      }
    }
    console.log(`\n${files.length - bad}/${files.length} documents clean.`);
    if (bad) {
      console.log("A document a rater can identify makes the preference numbers unreliable (07 §7.9).");
      process.exitCode = 1;
    }
    break;
  }

  default:
    console.error(`Unknown command "${command}"\n\n${USAGE}`);
    process.exit(1);
}
