/**
 * The firm-side taxonomy. Shared by the /firms enquiry form, the assessment's
 * benchmark capture, and the admin demand report — one vocabulary so the
 * numbers actually aggregate.
 */

export const FIRM_SIZES = [
  "Sole practitioner",
  "2–20 professionals",
  "21–100 professionals",
  "101–500 professionals",
  "501–2,000 professionals",
  "2,000+ professionals",
] as const;

export const JURISDICTIONS = [
  "Netherlands",
  "Germany",
  "Belgium",
  "France",
  "Denmark",
  "Sweden",
  "Norway",
  "Finland",
  "Ireland",
  "Luxembourg",
  "Austria",
  "Spain",
  "Italy",
  "Poland",
  "Other EU / EEA",
  "UK",
  "Multiple — European network",
] as const;

export const FIRM_ROLES = [
  "Managing / senior partner",
  "Audit partner",
  "Quality / compliance lead",
  "Methodology / technical department",
  "Innovation or technology lead",
  "Learning & development",
  "Manager / senior",
  "Other",
] as const;

/**
 * What a firm can express interest in.
 *
 * `available` marks what we can actually deliver today. Everything else is
 * openly labelled as in development — the enquiry form doubles as the demand
 * signal that decides build order, and promising shipped capabilities we don't
 * have would poison the one asset that matters most here: being trusted.
 */
export const FIRM_INTERESTS: {
  id: string;
  label: string;
  blurb: string;
  available: boolean;
}[] = [
  {
    id: "seats",
    label: "Firm-wide licence",
    blurb:
      "STAI+ for every professional, billed once, with an adoption console your quality function can point a regulator at.",
    available: false,
  },
  {
    id: "training",
    label: "Live training programmes",
    blurb:
      "Copilot Beginners, Copilot Experienced and the Full AI Package — delivered in your firm, with attendance and competence records formatted for your ISQM 1 file.",
    available: true,
  },
  {
    id: "compliance",
    label: "AI Act compliance workspace",
    blurb:
      "The artefacts the Act actually requires: use-register, per-system classification memos, Article 26 deployer mapping and Article 4 literacy evidence — maintained, not a one-off PDF.",
    available: false,
  },
  {
    id: "cpd",
    label: "Accredited CPD",
    blurb:
      "Verifiable CPD hours against STAI briefings, podcasts and assessments, recognised by your institute.",
    available: false,
  },
  {
    id: "canon",
    label: "Your firm's prompt canon",
    blurb:
      "Your own vetted, versioned prompt library mapped to your methodology and owned by your technical department.",
    available: false,
  },
  {
    id: "private",
    label: "Private deployment",
    blurb:
      "STAI inside your tenant, with SSO and your own content alongside ours. For firms whose network posture rules out anything else.",
    available: false,
  },
  {
    id: "benchmark",
    label: "Peer benchmarking",
    blurb:
      "Where your firm sits against comparable European firms on AI maturity, refreshed as the dataset grows.",
    available: false,
  },
];

export function interestLabel(id: string): string {
  return FIRM_INTERESTS.find((i) => i.id === id)?.label ?? id;
}
