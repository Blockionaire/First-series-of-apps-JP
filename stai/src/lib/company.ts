/**
 * ══════════════════════════════════════════════════════════════════════
 *  ACTION REQUIRED BEFORE PUBLIC LAUNCH — fill in the real values below.
 * ══════════════════════════════════════════════════════════════════════
 *
 * STAI is operated by a Dutch provider serving a European audience. Under the
 * Dutch implementation of the EU e-Commerce Directive (art. 3:15d Burgerlijk
 * Wetboek), an information-society service must make certain provider details
 * permanently, easily and directly accessible. `/legal/company` is that page.
 *
 * Every field is intentionally EMPTY. Nothing here may be guessed, inferred or
 * filled in from anything other than the operator's own registration records.
 * While a required field is blank the page shows it as outstanding rather than
 * inventing a value, and `companyDetailsComplete()` returns false.
 *
 * Required (art. 3:15d BW):
 *   legalName   — the registered legal name exactly as held at the KVK
 *   tradeName   — the trading name, only if it differs from the legal name
 *   kvkNumber   — Netherlands Chamber of Commerce (KVK) registration number
 *   address     — the geographic establishment address (a PO box is not enough)
 *   email       — a working address that reaches a human directly
 *
 * Conditional:
 *   vatNumber   — the BTW-identificatienummer, required once VAT-registered.
 *                 Not applicable while STAI is free and not trading; add it
 *                 before the first paid transaction.
 *   legalForm   — e.g. eenmanszaak, VOF, B.V. Not strictly required, but it
 *                 tells a professional reader who they are contracting with.
 *
 * Deliberately NOT claimed: STAI is not a regulated profession and holds no
 * professional-body authorisation, so no supervisory-authority disclosure is
 * made. Do not add one unless that genuinely changes.
 */

export type CompanyDetails = {
  legalName: string;
  tradeName: string;
  legalForm: string;
  kvkNumber: string;
  vatNumber: string;
  addressLines: string[];
  country: string;
  email: string;
};

export const COMPANY: CompanyDetails = {
  legalName: "", // e.g. "Voorbeeld Holding B.V." — REQUIRED
  tradeName: "", // only if different from legalName
  legalForm: "", // e.g. "B.V." / "eenmanszaak"
  kvkNumber: "", // REQUIRED — 8 digits
  vatNumber: "", // add when VAT-registered
  addressLines: [], // REQUIRED — e.g. ["Straatnaam 1", "1234 AB Amsterdam"]
  country: "Netherlands",
  email: "", // REQUIRED — e.g. "desk@stai.ai"
};

/** The fields that must be published before the site goes live. */
export const REQUIRED_FIELDS: { key: keyof CompanyDetails; label: string }[] = [
  { key: "legalName", label: "Registered legal name" },
  { key: "kvkNumber", label: "KVK registration number" },
  { key: "addressLines", label: "Business address" },
  { key: "email", label: "Contact email address" },
];

export function missingCompanyFields(): string[] {
  return REQUIRED_FIELDS.filter(({ key }) => {
    const v = COMPANY[key];
    return Array.isArray(v) ? v.length === 0 : !String(v).trim();
  }).map((f) => f.label);
}

export function companyDetailsComplete(): boolean {
  return missingCompanyFields().length === 0;
}
