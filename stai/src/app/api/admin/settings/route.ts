import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { isKnownKey, LIMIT_FIELDS } from "@/lib/site-config";

export const dynamic = "force-dynamic";

/**
 * Saves site settings.
 *
 * Takes a map of key → value and writes only the keys lib/site-config.ts
 * declares. That allowlist is the whole security story: without it, a POST
 * here could write any row in the settings table, and the settings table also
 * holds `founding_claimed`, which is a seat count tied to money.
 *
 * Numbers are clamped to the range their field declares before they are
 * stored, not only when they are read. The read path clamps too — belt and
 * braces around the values that bound the model bill — but storing a clamped
 * value means the admin screen shows what will actually happen rather than
 * the number that was typed.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { values?: Record<string, unknown> };
  const values = body.values;
  if (!values || typeof values !== "object") {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const written: string[] = [];
  const rejected: string[] = [];

  for (const [key, raw] of Object.entries(values)) {
    if (!isKnownKey(key)) {
      rejected.push(key);
      continue;
    }
    let value = String(raw ?? "");

    const numeric = LIMIT_FIELDS.find((f) => f.key === key);
    if (numeric) {
      const n = Number.parseInt(value, 10);
      if (!Number.isFinite(n)) {
        rejected.push(key);
        continue;
      }
      value = String(Math.min(Math.max(n, numeric.min), numeric.max));
    }

    // A headline is a headline, not a document. The cap is generous enough for
    // the longest field that ships (the standfirst) and stops a paste from
    // putting a megabyte in a column every page reads.
    await setSetting(key, value.slice(0, 2000));
    written.push(key);
  }

  return NextResponse.json({ ok: true, written: written.length, rejected });
}
