/* =====================================================================
   GOALS — what can be logged
   =====================================================================
   The catalogue of activity types. Metrics and standards point at a
   type by id, which is what keeps the goal engine generic: nothing in
   the code knows that "gym" belongs to health — the seeded metric says
   so, and you can point a new goal at the same type tomorrow.

   fields   which inputs the log form shows
   unit     what `value` means (kg, km, eur, count)
   duration minutes or hours, and what the field is called
   tags     optional checkboxes stored on the entry
   ===================================================================== */

export const ACTIVITY_TYPES = [
  {
    id: "weight", label: "Weight", action: "Log weight",
    fields: ["value"], unit: "kg", step: 0.1,
    valueLabel: "Bodyweight", placeholder: "63.8",
  },
  {
    id: "gym", label: "Gym session", action: "Log workout",
    fields: ["duration", "note"], duration: "minutes", durationLabel: "Duration",
    notePlaceholder: "Push day — bench 3×8 @ 60 kg",
  },
  {
    id: "run", label: "Run", action: "Log run",
    fields: ["value", "duration", "note"], unit: "km", step: 0.1,
    valueLabel: "Distance", duration: "minutes", durationLabel: "Time",
    /* A run is timed to the second, so the form asks for minutes and
       seconds and stores the total as decimal minutes. */
    seconds: true,
    pace: true,
  },
  {
    id: "lift", label: "Strength record", action: "Log strength",
    fields: ["value", "note"], unit: "kg", step: 2.5,
    valueLabel: "Weight", notePlaceholder: "Squat 5×5",
  },
  {
    id: "hours", label: "Focused hours", action: "Log business hours",
    fields: ["duration", "tags", "note"], duration: "hours", durationLabel: "Hours",
    tags: [
      { id: "building", label: "Building" },
      { id: "selling", label: "Selling" },
    ],
    notePlaceholder: "Cold outreach to 12 firms",
  },
  {
    id: "revenue", label: "Revenue", action: "Log revenue",
    fields: ["value", "note"], unit: "eur",
    valueLabel: "Amount", notePlaceholder: "Pilot invoice — firm X",
  },
  {
    id: "customer", label: "Paying customer", action: "Add customer",
    fields: ["note"], notePlaceholder: "Who?", noteRequired: true,
  },
  {
    id: "prospect", label: "Prospects added", action: "Add prospects",
    fields: ["value", "note"], unit: "count",
    valueLabel: "How many", placeholder: "10",
  },
  {
    id: "repayment", label: "Loan repayment", action: "Log repayment",
    fields: ["value", "note"], unit: "eur", valueLabel: "Amount",
  },
  {
    id: "balance", label: "Loan balance", action: "Update loan balance",
    fields: ["value", "note"], unit: "eur", valueLabel: "Outstanding",
  },
  {
    id: "networth", label: "Net worth", action: "Update net worth",
    fields: ["value", "note"], unit: "eur", valueLabel: "Net worth",
  },
  {
    id: "bible", label: "Bible reading", action: "Log Bible reading",
    fields: ["duration", "tags", "note"], duration: "minutes", durationLabel: "Minutes",
    defaultDuration: 15,
    tags: [{ id: "prayer", label: "Followed by intentional prayer" }],
    notePlaceholder: "Romans 8",
  },
  {
    id: "study", label: "Deeper study", action: "Log study session",
    fields: ["duration", "note", "reflection"], duration: "minutes", durationLabel: "Minutes",
    defaultDuration: 50,
    notePlaceholder: "Second-temple period — context of the Gospels",
    reflection: [
      { id: "god", prompt: "What have I learned about God?" },
      { id: "bible", prompt: "What have I learned about the Bible?" },
      { id: "prayer", prompt: "What has changed in my prayer?" },
      { id: "questions", prompt: "What questions do I have?" },
    ],
  },
  {
    id: "learning", label: "Learning session", action: "Log learning",
    fields: ["duration", "topic", "note"], duration: "minutes", durationLabel: "Minutes",
    defaultDuration: 30,
    notePlaceholder: "Watched two films on escapements",
  },

  /* Generic types, so a goal you invent next year has something to
     point at without a code change. */
  {
    id: "session", label: "Session", action: "Log session",
    fields: ["duration", "note"], duration: "minutes", durationLabel: "Minutes",
  },
  {
    id: "amount", label: "Amount", action: "Log amount",
    fields: ["value", "note"], unit: "count", valueLabel: "Value",
  },
];

const BY_ID = new Map(ACTIVITY_TYPES.map(t => [t.id, t]));

export const activityType = id => BY_ID.get(id) || null;

export const typeLabel = id => (BY_ID.get(id)?.label) || id;

/* Units a metric can carry. Kept here so the metric form and the
   formatter never drift apart. */
export const UNITS = [
  { id: "kg", label: "kilograms" },
  { id: "km", label: "kilometres" },
  { id: "eur", label: "euros" },
  { id: "hours", label: "hours" },
  { id: "minutes", label: "minutes" },
  { id: "sessions", label: "sessions" },
  { id: "count", label: "count" },
  { id: "percent", label: "percent" },
  { id: "pace", label: "pace (min/km)" },
];

/* How a metric turns a pile of entries into one number. */
export const AGGREGATIONS = [
  { id: "latest",     label: "Latest value",   help: "The most recent reading, like bodyweight." },
  { id: "cumulative", label: "Running total",  help: "Everything added up, like revenue." },
  { id: "count",      label: "Number of logs", help: "How many times it happened, like gym sessions." },
  { id: "average",    label: "Average",        help: "The mean of everything logged." },
  { id: "max",        label: "Best",           help: "The highest value logged, like a lift." },
  { id: "pace",       label: "Average pace",   help: "Total time divided by total distance." },
];
