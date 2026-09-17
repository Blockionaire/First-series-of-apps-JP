import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { COMPANY, missingCompanyFields } from "@/lib/company";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Company information",
  description: "Who operates STAI: provider details under Dutch and EU law.",
  path: "/legal/company",
});

/**
 * Provider details required of an information-society service under the Dutch
 * implementation of the EU e-Commerce Directive (art. 3:15d BW).
 *
 * Values come from src/lib/company.ts and are blank until the operator fills
 * them in from their own registration records. Nothing on this page may be
 * inferred — an outstanding field is shown as outstanding.
 */
export default function CompanyPage() {
  const missing = missingCompanyFields();
  const placeholder = (label: string) => (
    <span className="f-mono text-[0.8rem] text-signal-down">— {label} not yet published —</span>
  );

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Registered legal name",
      value: COMPANY.legalName || placeholder("registered name"),
    },
    ...(COMPANY.tradeName ? [{ label: "Trading as", value: COMPANY.tradeName }] : []),
    ...(COMPANY.legalForm ? [{ label: "Legal form", value: COMPANY.legalForm }] : []),
    {
      label: "KVK number",
      value: COMPANY.kvkNumber || placeholder("KVK number"),
    },
    ...(COMPANY.vatNumber ? [{ label: "VAT (BTW) number", value: COMPANY.vatNumber }] : []),
    {
      label: "Business address",
      value:
        COMPANY.addressLines.length > 0 ? (
          <span className="block">
            {COMPANY.addressLines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
            <span className="block">{COMPANY.country}</span>
          </span>
        ) : (
          placeholder("address")
        ),
    },
    {
      label: "Contact",
      value: COMPANY.email ? (
        <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-4 hover:text-cream-100">
          {COMPANY.email}
        </a>
      ) : (
        placeholder("contact email")
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Legal
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100">Company information</h1>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        STAI is operated from the Netherlands and serves readers across Europe. These are the provider details
        an information-society service must publish under Dutch law (art. 3:15d BW), which implements the EU
        e-Commerce Directive.
      </p>

      {missing.length > 0 && (
        <div className="mt-8 border p-5" style={{ borderColor: "var(--color-signal-down)" }} role="status">
          <p className="f-mono text-[0.68rem] font-bold tracking-[0.16em] uppercase text-signal-down">
            Not ready for publication
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            The following details have not been supplied yet and are shown as outstanding rather than filled in
            with anything approximate: <span className="text-cream-100">{missing.join(", ")}</span>. Add them in{" "}
            <span className="f-mono text-[0.8rem]">src/lib/company.ts</span> before making this site public.
          </p>
        </div>
      )}

      <dl className="mt-10">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1 border-t py-4 rule sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="f-label" style={{ color: "var(--ink-faint)" }}>
              {r.label}
            </dt>
            <dd className="text-[0.95rem] text-cream-200">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="prose-stai mt-10">
        <h2>Scope of this service</h2>
        <p>
          STAI publishes editorial analysis and practitioner tools for audit, accountancy and finance
          professionals. It is not a regulated profession, holds no professional-body authorisation, and nothing
          published here is legal, audit or professional advice. Engagement-level judgement remains with the
          practitioner.
        </p>
        <h2>Related</h2>
        <p>
          <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/terms">Terms of use</Link>
        </p>
      </div>
    </div>
  );
}
