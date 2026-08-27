/* =====================================================================
   GELDZAKEN — startgegevens
   =====================================================================
   Waar de app mee begint als je hem voor het eerst opent: een set
   categorieën die op een Nederlands huishouden past, een paar potjes om
   uit te kiezen, en de kolomnamen van de grote banken zodat een
   geëxporteerd bankbestand meteen herkend wordt.

   Alles hierin is een suggestie. Je kunt elke categorie hernoemen,
   een ander icoon geven of weggooien.
   ===================================================================== */

/* ---------------------------------------------------------------
   Categorieën
   ---------------------------------------------------------------
   `vast` betekent: hoort standaard bij je vaste lasten. Dat bepaalt in
   welk blok een uitgave op het maandoverzicht terechtkomt.
   --------------------------------------------------------------- */
export const CATEGORIEEN = [
  /* Inkomsten */
  { id: "cat-salaris",      naam: "Salaris",          icoon: "💼", kleur: "#3ddc97", soort: "inkomst" },
  { id: "cat-toeslagen",    naam: "Toeslagen",        icoon: "🏛️", kleur: "#22d3ee", soort: "inkomst" },
  { id: "cat-extra",        naam: "Extra inkomsten",  icoon: "✨", kleur: "#a78bfa", soort: "inkomst" },

  /* Vaste lasten */
  { id: "cat-wonen",        naam: "Huur / hypotheek", icoon: "🏠", kleur: "#5b8dff", soort: "uitgave", vast: true },
  { id: "cat-energie",      naam: "Energie & water",  icoon: "⚡", kleur: "#f5a524", soort: "uitgave", vast: true },
  { id: "cat-verzekering",  naam: "Verzekeringen",    icoon: "🛡️", kleur: "#60a5fa", soort: "uitgave", vast: true },
  { id: "cat-zorg",         naam: "Zorg",             icoon: "💊", kleur: "#f472b6", soort: "uitgave", vast: true },
  { id: "cat-internet",     naam: "Internet & bellen",icoon: "📶", kleur: "#818cf8", soort: "uitgave", vast: true },
  { id: "cat-abonnementen", naam: "Abonnementen",     icoon: "📺", kleur: "#c084fc", soort: "uitgave", vast: true },
  { id: "cat-belasting",    naam: "Belastingen",      icoon: "🧾", kleur: "#94a3b8", soort: "uitgave", vast: true },
  { id: "cat-vervoer",      naam: "Auto & vervoer",   icoon: "🚗", kleur: "#38bdf8", soort: "uitgave", vast: true },

  /* Boodschappen en dagelijkse dingen */
  { id: "cat-boodschappen", naam: "Boodschappen",     icoon: "🛒", kleur: "#4ade80", soort: "uitgave", budget: null },
  { id: "cat-uiteten",      naam: "Uit eten & café",  icoon: "🍽️", kleur: "#fb923c", soort: "uitgave" },
  { id: "cat-kleding",      naam: "Kleding",          icoon: "👕", kleur: "#f87171", soort: "uitgave" },
  { id: "cat-huis",         naam: "Huis & tuin",      icoon: "🪴", kleur: "#84cc16", soort: "uitgave" },
  { id: "cat-vrijetijd",    naam: "Vrije tijd",       icoon: "🎬", kleur: "#e879f9", soort: "uitgave" },
  { id: "cat-sport",        naam: "Sport",            icoon: "🏋️", kleur: "#2dd4bf", soort: "uitgave" },
  { id: "cat-vakantie",     naam: "Vakantie",         icoon: "✈️", kleur: "#0ea5e9", soort: "uitgave" },
  { id: "cat-cadeaus",      naam: "Cadeaus",          icoon: "🎁", kleur: "#fb7185", soort: "uitgave" },
  { id: "cat-kinderen",     naam: "Kinderen",         icoon: "🧸", kleur: "#fbbf24", soort: "uitgave" },
  { id: "cat-huisdier",     naam: "Huisdieren",       icoon: "🐾", kleur: "#a3a3a3", soort: "uitgave" },
  { id: "cat-overig",       naam: "Overig",           icoon: "▫️", kleur: "#8b98a9", soort: "uitgave" },
];

/* Potjes die de meeste huishoudens uiteindelijk toch aanmaken. Je kiest
   ze bij de eerste keer opstarten met één tik. */
export const POTJE_SUGGESTIES = [
  /* Vaste lasten: geld dat er elke maand sowieso afgaat. */
  { naam: "Huur of hypotheek", icoon: "🏠", kleur: "#5b8dff", soort: "vast",   maandelijks: 0 },
  { naam: "Energie & water",   icoon: "⚡", kleur: "#60a5fa", soort: "vast",   maandelijks: 0 },
  { naam: "Verzekeringen",     icoon: "🛡️", kleur: "#818cf8", soort: "vast",   maandelijks: 0 },
  { naam: "Abonnementen",      icoon: "📺", kleur: "#c084fc", soort: "vast",   maandelijks: 0 },

  /* Vrij te besteden: bedoeld om deze maand op te maken. */
  { naam: "Boodschappen",      icoon: "🛒", kleur: "#f5a524", soort: "vrij",   maandelijks: 0 },
  { naam: "Uitgaan & eten",    icoon: "🍽️", kleur: "#fb923c", soort: "vrij",   maandelijks: 0 },

  /* Sparen: dit bouwt op. */
  { naam: "Vakantie",          icoon: "✈️", kleur: "#0ea5e9", soort: "sparen", maandelijks: 150 },
  { naam: "Auto & onderhoud",  icoon: "🔧", kleur: "#38bdf8", soort: "sparen", maandelijks: 75 },
  { naam: "Buffer",            icoon: "🛟", kleur: "#a78bfa", soort: "sparen", maandelijks: 100 },
];

/* Trefwoorden die de app gebruikt om een nieuwe of ingelezen boeking
   alvast een categorie te geven. Je eigen regels gaan hier altijd
   voor. */
export const TREFWOORDEN = [
  ["cat-boodschappen", ["albert heijn", "ah to go", "jumbo", "lidl", "aldi", "plus ", "dirk", "coop", "spar", "picnic", "crisp", "vomar", "hoogvliet", "poiesz", "makro", "boodschap"]],
  ["cat-uiteten",      ["thuisbezorgd", "uber eats", "deliveroo", "restaurant", "cafe", "café", "bakker", "starbucks", "mcdonald", "kfc", "domino", "new york pizza", "eetcafe", "brasserie", "lunch"]],
  ["cat-vervoer",      ["shell", "bp ", "esso", "tinq", "tango", "ns ", "ns-", "ov-chipkaart", "9292", "greenwheels", "anwb", "parkeren", "q-park", "parkmobile", "yellowbrick", "fastned", "allego", "garage", "apk", "kwikfit"]],
  ["cat-energie",      ["eneco", "vattenfall", "essent", "greenchoice", "budget energie", "vandebron", "oxxio", "waternet", "vitens", "brabant water", "pwn", "dunea", "energie"]],
  ["cat-internet",     ["kpn", "ziggo", "t-mobile", "odido", "vodafone", "simyo", "tele2", "youfone", "hollandsnieuwe", "delta fiber", "caiway"]],
  ["cat-abonnementen", ["netflix", "spotify", "disney", "videoland", "hbo", "viaplay", "amazon prime", "apple.com/bill", "icloud", "google one", "youtube", "dropbox", "adobe", "microsoft", "chatgpt", "openai", "strava"]],
  ["cat-verzekering",  ["verzeker", "aegon", "nationale-nederlanden", "centraal beheer", "interpolis", "univé", "unive", "fbto", "ohra", "ditzo", "allianz", "asr", "achmea", "polis"]],
  ["cat-zorg",         ["zilveren kruis", "cz ", "vgz", "menzis", "zorgverzeker", "apotheek", "tandarts", "huisarts", "fysio", "ziekenhuis", "etos", "kruidvat"]],
  ["cat-wonen",        ["hypothe", "huur", "woningcorporatie", "vve", "ymere", "stadgenoot", "portaal", "vestia", "erfpacht"]],
  ["cat-belasting",    ["belastingdienst", "gemeente", "waterschap", "hoogheemraadschap", "cjib", "rdw", "wegenbelasting", "motorrijtuigen"]],
  ["cat-sport",        ["basic-fit", "sportschool", "fitness", "gym", "tennis", "hockey", "voetbal", "zwembad", "decathlon"]],
  ["cat-kleding",      ["zalando", "h&m", "hm.com", "zara", "primark", "c&a", "wehkamp", "bijenkorf", "nike", "adidas", "vanharen", "omoda", "schoen"]],
  ["cat-vrijetijd",    ["pathe", "pathé", "kinepolis", "bioscoop", "ticketmaster", "eventim", "boekhandel", "bol.com", "coolblue", "mediamarkt", "steam", "playstation", "nintendo"]],
  ["cat-vakantie",     ["booking.com", "airbnb", "transavia", "klm", "ryanair", "easyjet", "tui", "sunweb", "camping", "hotel", "corendon", "vliegticket"]],
  ["cat-kinderen",     ["kinderopvang", "bso", "peuterspeelzaal", "school", "intertoys", "kinderdagverblijf"]],
  ["cat-huisdier",     ["dierenarts", "pets place", "dierenwinkel", "welkoop", "zooplus"]],
  ["cat-salaris",      ["salaris", "loon", "periodiek loon", "maandloon", "wedde", "uwv"]],
  ["cat-toeslagen",    ["toeslag", "kinderbijslag", "svb", "huurtoeslag", "zorgtoeslag", "kindgebonden"]],
];

/* ---------------------------------------------------------------
   Bankbestanden
   ---------------------------------------------------------------
   Elke bank exporteert net iets anders. Deze profielen vertellen de
   inleesmodule welke kolom wat betekent. Herkent hij je bank niet, dan
   mag je de kolommen zelf aanwijzen — het profiel "eigen" doet niets
   anders dan dat.
   --------------------------------------------------------------- */
export const BANKPROFIELEN = [
  {
    id: "ing",
    naam: "ING",
    herken: ["Datum", "Naam / Omschrijving", "Af Bij"],
    datum: "Datum",
    omschrijving: ["Naam / Omschrijving", "Mededelingen"],
    bedrag: "Bedrag (EUR)",
    richting: { kolom: "Af Bij", af: ["af"] },
    tegenrekening: "Tegenrekening",
  },
  {
    id: "rabobank",
    naam: "Rabobank",
    herken: ["Datum", "Bedrag", "Naam tegenpartij"],
    datum: "Datum",
    omschrijving: ["Naam tegenpartij", "Omschrijving-1", "Omschrijving-2"],
    bedrag: "Bedrag",
    /* Rabobank zet het minteken in het bedrag zelf. */
    richting: null,
    tegenrekening: "Tegenrekening IBAN/BBAN",
  },
  {
    id: "abnamro",
    naam: "ABN AMRO",
    herken: ["transactiedatum", "bedrag", "omschrijving"],
    datum: "transactiedatum",
    omschrijving: ["omschrijving"],
    bedrag: "bedrag",
    richting: null,
    tegenrekening: "tegenrekening",
  },
  {
    id: "bunq",
    naam: "bunq",
    herken: ["Date", "Amount", "Counterparty"],
    datum: "Date",
    omschrijving: ["Counterparty", "Description"],
    bedrag: "Amount",
    richting: null,
    tegenrekening: "Counterparty account",
  },
  {
    id: "geldzaken",
    naam: "Export uit Geldzaken",
    herken: ["datum", "omschrijving", "bedrag", "soort"],
    datum: "datum",
    omschrijving: ["omschrijving"],
    bedrag: "bedrag",
    richting: { kolom: "soort", af: ["uitgave"] },
    categorie: "categorie",
  },
];

/* Iconen om uit te kiezen bij categorieën, potjes en doelen. */
export const ICONEN = [
  "🏠", "⚡", "💧", "🛡️", "💊", "📶", "📺", "🧾", "🚗", "🚲", "🚆", "⛽",
  "🛒", "🍽️", "☕", "🍺", "👕", "👟", "🪴", "🛠️", "🎬", "🎮", "🎧", "📚",
  "🏋️", "⚽", "🎾", "✈️", "🏖️", "⛺", "🎁", "🎂", "🧸", "🍼", "🐾", "🐶",
  "💼", "🏛️", "💶", "💰", "🐖", "📈", "🎓", "💍", "🛟", "🔧", "🧹", "✨",
];

/* Een potje dat "Energie" heet hoort geen huisje te krijgen. Dit raadt
   een passend icoon uit de naam; kies je zelf iets anders, dan wint dat
   natuurlijk. */
const ICOON_WOORDEN = [
  ["⚡", ["energie", "stroom", "gas", "licht"]],
  ["💧", ["water", "waterschap"]],
  ["🏠", ["huur", "hypotheek", "woning", "wonen", "vve"]],
  ["🛡️", ["verzeker", "polis", "aansprakelijk"]],
  ["💊", ["zorg", "ziektekost", "apotheek", "tandarts"]],
  ["📶", ["internet", "telefoon", "bellen", "mobiel", "wifi"]],
  ["📺", ["abonnement", "netflix", "spotify", "streaming"]],
  ["🧾", ["belasting", "gemeente", "aanslag"]],
  ["🚗", ["auto", "vervoer", "benzine", "tanken"]],
  ["🚲", ["fiets"]],
  ["🚆", ["ov", "trein", "reizen"]],
  ["🛒", ["boodschap", "supermarkt", "eten"]],
  ["🍽️", ["uitgaan", "uit eten", "restaurant", "horeca"]],
  ["👕", ["kleding", "kleren", "schoenen"]],
  ["🎁", ["cadeau", "feest", "verjaardag", "sint", "kerst"]],
  ["✈️", ["vakantie", "reis", "weekendje"]],
  ["🏋️", ["sport", "fitness", "sportschool"]],
  ["🧸", ["kind", "kinderen", "opvang", "bso"]],
  ["🐾", ["huisdier", "hond", "kat", "dierenarts"]],
  ["🛟", ["buffer", "noodpot", "reserve", "onvoorzien"]],
  ["🔧", ["onderhoud", "klussen", "reparatie"]],
  ["🎓", ["studie", "school", "cursus", "opleiding"]],
  ["📈", ["beleggen", "aandelen", "pensioen"]],
];

export function raadIcoon(naam, standaard = "🫙") {
  const tekst = String(naam || "").toLowerCase();
  for (const [icoon, woorden] of ICOON_WOORDEN) {
    if (woorden.some(w => tekst.includes(w))) return icoon;
  }
  return standaard;
}

export const KLEUREN = [
  "#3ddc97", "#22d3ee", "#5b8dff", "#818cf8", "#a78bfa", "#e879f9",
  "#f472b6", "#ff6b81", "#fb923c", "#f5a524", "#facc15", "#84cc16",
  "#4ade80", "#2dd4bf", "#60a5fa", "#8b98a9",
];
