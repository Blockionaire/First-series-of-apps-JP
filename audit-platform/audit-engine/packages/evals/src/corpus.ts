import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { DataClass } from "@audit/domain";

/**
 * A corpus case is a folder: the input, and an answer key the engine never sees.
 * Synthetic (C0) cases live in the repository; anonymised (C1) cases never do.
 */
export const AnswerKey = z.object({
  /** Risks a competent auditor should identify. Library id where one fits. */
  risks: z.array(z.object({
    libraryRef: z.string().nullable(),
    title: z.string(),
    assertions: z.array(z.string()),
    source: z.enum(["firm_working_paper", "sme_addition", "planted"]).default("planted"),
  })),
  controls: z.array(z.object({
    libraryRef: z.string().nullable(),
    title: z.string(),
    source: z.enum(["firm_working_paper", "sme_addition", "planted"]).default("planted"),
  })),
  /** Coverage items an auditor would consider addressed by this evidence. */
  coveredItems: z.array(z.string()).default([]),
  /** Facts an experienced auditor would still need — the missing-fact detection target. */
  expectedMissing: z.array(z.string()).default([]),
  notes: z.string().nullable().default(null),
});
export type AnswerKey = z.infer<typeof AnswerKey>;

export const CaseMeta = z.object({
  caseId: z.string(),
  engagementId: z.string(),
  title: z.string(),
  set: z.enum(["dev", "test"]),
  origin: z.enum(["synthetic", "anonymised_real"]),
  sourceClass: DataClass,
  language: z.enum(["nl", "en", "de"]).default("en"),
  stresses: z.array(z.string()).default([]),
  clientProfile: z.string().nullable().default(null),
});
export type CaseMeta = z.infer<typeof CaseMeta>;

export interface CorpusCase {
  meta: CaseMeta;
  transcript: string;
  answerKey: AnswerKey | null;
  dir: string;
}

export function loadCase(dir: string): CorpusCase {
  const meta = CaseMeta.parse(parseYaml(readFileSync(join(dir, "case.yaml"), "utf8")));
  const transcript = readFileSync(join(dir, "transcript.txt"), "utf8");
  const keyPath = join(dir, "answer-key.yaml");
  const answerKey = existsSync(keyPath)
    ? AnswerKey.parse(parseYaml(readFileSync(keyPath, "utf8")))
    : null;
  return { meta, transcript, answerKey, dir };
}

export function loadCorpus(root: string, set?: "dev" | "test"): CorpusCase[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "case.yaml")))
    .map((d) => loadCase(join(root, d.name)))
    .filter((c) => !set || c.meta.set === set)
    .sort((a, b) => a.meta.caseId.localeCompare(b.meta.caseId));
}
