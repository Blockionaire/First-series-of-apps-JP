import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { currentUser } from "@/lib/auth";
import {
  TOGGLES,
  HOME_FIELDS,
  LIMIT_FIELDS,
  enabledMap,
  homeCopy,
  limit,
} from "@/lib/site-config";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Site settings — admin",
  description: "STAI back office.",
  path: "/admin/settings",
  noIndex: true,
});

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin/settings");

  const enabled = await enabledMap();
  const copy = await homeCopy();
  const limits = Object.fromEntries(
    await Promise.all(LIMIT_FIELDS.map(async (f) => [f.key, await limit(f.key)] as const))
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="f-label" style={{ color: "var(--ink-faint)" }}>
            Back office
          </p>
          <h1 className="f-display mt-2 text-4xl text-cream-100">Site settings</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="btn btn-ghost btn-sm">
            The desk
          </Link>
        </div>
      </header>

      <SettingsForm
        toggles={TOGGLES}
        enabled={enabled}
        textFields={HOME_FIELDS}
        copy={copy}
        limitFields={LIMIT_FIELDS}
        limits={limits}
      />
    </div>
  );
}
