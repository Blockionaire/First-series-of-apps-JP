import { createHash } from "node:crypto";
import type { IngestedSource, RawInput, TranscriptSegment } from "@audit/domain";

/** Stable id so a re-ingest of the same text yields the same segment ids and refs. */
function segmentId(caseId: string, ordinal: number, text: string): string {
  const h = createHash("sha256").update(`${caseId}:${ordinal}:${text}`).digest("hex");
  return `seg_${ordinal.toString().padStart(4, "0")}_${h.slice(0, 8)}`;
}

const SPEAKER_LINE = /^\s*(?:\[(?<t>[\d:.]+)\]\s*)?(?<sp>[A-Z][\w .'-]{1,40}?)\s*(?:\((?<role>[^)]{1,40})\))?\s*:\s*(?<text>.+)$/;

/**
 * Phase 0 ingest: plain text or VTT into addressable segments.
 * A segment is one speaker turn; everything downstream cites `segmentId` + a char range.
 */
export function ingest(input: RawInput): IngestedSource {
  const lines = input.content.replace(/\r\n/g, "\n").split("\n");
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  const push = () => {
    if (current && current.text.trim().length > 0) {
      current.text = current.text.trim();
      segments.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    if (input.format === "vtt" && (/^WEBVTT/.test(line) || /^\d+$/.test(line.trim()) || line.includes("-->"))) {
      continue;
    }
    const m = line.match(SPEAKER_LINE);
    if (m?.groups) {
      push();
      current = {
        segmentId: "",
        ordinal: segments.length,
        speaker: m.groups["sp"]?.trim() ?? null,
        speakerRole: m.groups["role"]?.trim() ?? null,
        tStartMs: null,
        tEndMs: null,
        text: m.groups["text"] ?? "",
      };
    } else if (line.trim().length === 0) {
      push();
    } else if (current) {
      current.text += " " + line.trim();
    } else {
      current = {
        segmentId: "",
        ordinal: segments.length,
        speaker: null,
        speakerRole: null,
        tStartMs: null,
        tEndMs: null,
        text: line.trim(),
      };
    }
  }
  push();

  for (const s of segments) s.segmentId = segmentId(input.caseId, s.ordinal, s.text);

  return {
    caseId: input.caseId,
    engagementId: input.engagementId,
    language: input.language,
    sourceClass: input.sourceClass,
    segments,
    clientProfile: input.clientProfile,
  };
}

/** The transcript as the model sees it: every line addressable, so a citation can be checked. */
export function renderSourceForPrompt(src: IngestedSource): string {
  return src.segments
    .map((s) => `[${s.segmentId}]${s.speaker ? ` ${s.speaker}${s.speakerRole ? ` (${s.speakerRole})` : ""}:` : ""} ${s.text}`)
    .join("\n");
}
