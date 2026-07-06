/* =========================================================================
   CONTENT.JS — HIER STAAT ALLE INHOUD VAN DE WEBSITE
   =========================================================================
   Dit is het enige bestand dat je hoeft aan te passen:
   - Teksten wijzigen: pas de strings hieronder aan.
   - Foto's vervangen: zet je foto's in de map images/ en verwijs ernaar
     bij "before" / "after" / "src". Elk formaat werkt (jpg, png, webp).
   - Ruimte toevoegen of verwijderen: voeg een blok toe aan (of haal het
     weg uit) de lijst "rooms". De pagina bouwt zichzelf automatisch op.
   - Hotspots: stipjes op de NA-foto met uitleg. x en y zijn procenten
     vanaf linksboven. Laat de lijst leeg ([]) als je ze niet wilt.
   ========================================================================= */

const CONTENT = {

  site: {
    name: "Anno 1780",
    location: "Oud-Beijerland",
    instagram: {
      handle: "@huisjeoostvoorstraat",
      url: "https://www.instagram.com/huisjeoostvoorstraat/"
    }
  },

  hero: {
    kicker: "Oud-Beijerland · Anno 1780 · Boven de winkel",
    title: "Van casco naar thuis",
    subtitle:
      "Een appartement in het oude centrum van Oud-Beijerland, volledig gestript " +
      "en opnieuw opgebouwd. Alleen de eeuwenoude kapconstructie bleef staan. " +
      "Sleep de schuif en zie het verschil.",
    before: "images/hero-voor.svg",
    after: "images/hero-na.svg"
  },

  stats: [
    { value: 1780, label: "Bouwjaar van het pand", noFormat: true },
    { value: 14,   label: "Maanden verbouwd" },                    // <-- pas aan
    { value: 100,  suffix: "%", label: "Gestript en opnieuw opgebouwd" },
    { value: 1,    label: "Origineel bewaard: het dak" }
  ],

  story: {
    kicker: "Het verhaal",
    title: "Een pand met geschiedenis, een appartement zonder toekomst",
    paragraphs: [
      "Midden in het oude centrum van Oud-Beijerland staat een pand uit 1780. " +
      "Beneden een winkel, daarboven een appartement dat de tijd niet had " +
      "bijgehouden: geen isolatie, een aflopende vloer en een indeling die " +
      "allang niet meer werkte.",

      "Opknappen was geen optie meer — dus kozen we voor de grondige aanpak. " +
      "Het appartement is volledig gestript, tot er niets meer over was dan het " +
      "casco. Alleen de originele kapconstructie uit 1780 bleef staan; die is " +
      "schoongemaakt, hersteld en geschilderd, en vormt nu het hart van het " +
      "nieuwe interieur.",

      "De hele verbouwing hebben we gedocumenteerd op Instagram, waar familie " +
      "en vrienden elke stap konden volgen. Deze site laat het eindresultaat " +
      "zien: per ruimte het voor en na, wat er is gedaan, waar we tegenaan " +
      "liepen en welke keuzes we maakten."
    ]
  },

  timeline: {
    kicker: "De tijdlijn",
    title: "Zo verliep de verbouwing",
    items: [
      {
        period: "Fase 1",
        title: "Strippen tot op het casco",
        text: "Alles eruit: wanden, plafonds, vloeren en installaties. Terug tot " +
              "de kale constructie, zodat we konden zien waar we echt mee te " +
              "maken hadden.",
        image: "images/tijdens-1.svg"
      },
      {
        period: "Fase 2",
        title: "Constructie en vloer",
        text: "De aflopende vloer is aangepakt en het casco waar nodig hersteld " +
              "en verstevigd. De basis moest goed zijn voordat er iets nieuws in " +
              "kon.",
        image: "images/tijdens-2.svg"
      },
      {
        period: "Fase 3",
        title: "Het dak",
        text: "De originele kap uit 1780 is schoongemaakt, gerepareerd en " +
              "geschilderd. Het enige onderdeel dat de hele verbouwing overleefde " +
              "— en dat mag gezien worden.",
        image: "images/tijdens-3.svg"
      },
      {
        period: "Fase 4",
        title: "Isolatie en installaties",
        text: "Van niets naar volledig geïsoleerd. Nieuwe elektra, waterleidingen " +
              "en verwarming, weggewerkt in de nieuwe wanden en vloeren.",
        image: "images/tijdens-4.svg"
      },
      {
        period: "Fase 5",
        title: "Indeling en afbouw",
        text: "Nieuwe wanden, plafonds en kozijnen. De indeling is opnieuw " +
              "bedacht, passend bij hoe we nu wonen.",
        image: "images/tijdens-5.svg"
      },
      {
        period: "Fase 6",
        title: "Afwerking",
        text: "Keuken, badkamer, vloeren, schilderwerk en alle details. De fase " +
              "waarin het van bouwplaats langzaam een thuis werd.",
        image: "images/tijdens-6.svg"
      }
    ]
  },

  /* =========================================================================
     PLATTEGROND — klikbare kamers, schuifbaar tussen oude en nieuwe indeling
     Elke kamer: x/y = positie linksboven, w/h = breedte/hoogte, alles in
     procenten van de plattegrond. "room" verwijst naar het id van de ruimte
     hierboven (de klik scrolt daarnaartoe). Pas de vakken aan tot ze bij
     jullie echte plattegrond passen — of vervang ze door een eigen tekening.
     ========================================================================= */
  floorplan: {
    kicker: "De plattegrond",
    title: "Eén appartement, twee indelingen",
    text: "Sleep de schuif om te zien hoe de indeling veranderde, en klik op " +
          "een ruimte om er direct naartoe te gaan — dat werkt in allebei de " +
          "plattegronden.",
    labelBefore: "Oude indeling",
    labelAfter: "Nieuwe indeling",
    before: [
      { room: "entree",     label: "Entree",     x: 2,  y: 72, w: 16, h: 26 },
      { room: "hal",        label: "Hal",        x: 20, y: 72, w: 34, h: 26 },
      { room: "keuken",     label: "Keuken",     x: 2,  y: 2,  w: 22, h: 34 },
      { room: "woonkamer",  label: "Woonkamer",  x: 26, y: 2,  w: 34, h: 68 },
      { room: "slaapkamer", label: "Slaapkamer", x: 62, y: 2,  w: 36, h: 44 },
      { room: "badkamer",   label: "Badkamer",   x: 62, y: 48, w: 20, h: 22 },
      { room: "dak",        label: "Zolder",     x: 84, y: 48, w: 14, h: 50 }
    ],
    after: [
      { room: "entree",     label: "Entree",     x: 2,  y: 72, w: 14, h: 26 },
      { room: "hal",        label: "Hal",        x: 18, y: 72, w: 24, h: 26 },
      { room: "woonkamer",  label: "Woonkamer",  x: 2,  y: 2,  w: 40, h: 68 },
      { room: "keuken",     label: "Keuken",     x: 44, y: 2,  w: 26, h: 40 },
      { room: "badkamer",   label: "Badkamer",   x: 44, y: 44, w: 26, h: 26 },
      { room: "slaapkamer", label: "Slaapkamer", x: 72, y: 2,  w: 26, h: 68 },
      { room: "dak",        label: "Zolder — het dak", x: 44, y: 72, w: 54, h: 26 }
    ]
  },

  roomsIntro: {
    kicker: "Ruimte voor ruimte",
    title: "Sleep de schuif en zie de transformatie",
    text: "Elke ruimte heeft zijn eigen verhaal. Bekijk het voor en na, en klik " +
          "op de tabjes voor wat er is gedaan, de obstakels onderweg en de " +
          "keuzes die we maakten."
  },

  rooms: [
    {
      id: "woonkamer",
      name: "Woonkamer",
      tagline: "Het hart van het appartement",
      before: "images/woonkamer-voor.svg",
      after: "images/woonkamer-na.svg",
      tabs: {
        "Wat we deden":
          "Beschrijf hier wat er in de woonkamer is gedaan: nieuwe vloer, " +
          "wanden, plafond, elektra, verwarming…",
        "Obstakels":
          "Beschrijf hier waar jullie tegenaan liepen — bijvoorbeeld de " +
          "aflopende vloer of verrassingen achter oude wanden.",
        "Onze keuzes":
          "Beschrijf hier de keuzes: materialen, kleuren, indeling en waarom " +
          "jullie daarvoor kozen."
      },
      /* Voorbeeld-hotspots: verplaats of verwijder ze naar wens. */
      hotspots: [
        { x: 30, y: 40, title: "Nieuwe vloer",
          text: "Korte uitleg over de vloer: opbouw, isolatie, afwerking." },
        { x: 72, y: 25, title: "Zichtbaar houtwerk",
          text: "Korte uitleg over een detail dat je hier wilt uitlichten." }
      ]
    },
    {
      id: "keuken",
      name: "Keuken",
      tagline: "Van gedateerd naar op maat",
      before: "images/keuken-voor.svg",
      after: "images/keuken-na.svg",
      tabs: {
        "Wat we deden": "Beschrijf hier wat er in de keuken is gedaan.",
        "Obstakels": "Beschrijf hier de obstakels in de keuken.",
        "Onze keuzes": "Beschrijf hier de keuzes voor de keuken."
      },
      hotspots: []
    },
    {
      id: "badkamer",
      name: "Badkamer",
      tagline: "Volledig opnieuw opgebouwd",
      before: "images/badkamer-voor.svg",
      after: "images/badkamer-na.svg",
      tabs: {
        "Wat we deden": "Beschrijf hier wat er in de badkamer is gedaan.",
        "Obstakels": "Beschrijf hier de obstakels in de badkamer.",
        "Onze keuzes": "Beschrijf hier de keuzes voor de badkamer."
      },
      hotspots: []
    },
    {
      id: "slaapkamer",
      name: "Slaapkamer",
      tagline: "Rust en warmte",
      before: "images/slaapkamer-voor.svg",
      after: "images/slaapkamer-na.svg",
      tabs: {
        "Wat we deden": "Beschrijf hier wat er in de slaapkamer is gedaan.",
        "Obstakels": "Beschrijf hier de obstakels in de slaapkamer.",
        "Onze keuzes": "Beschrijf hier de keuzes voor de slaapkamer."
      },
      hotspots: []
    },
    {
      id: "dak",
      name: "Het dak",
      tagline: "Het enige originele onderdeel — anno 1780",
      before: "images/dak-voor.svg",
      after: "images/dak-na.svg",
      tabs: {
        "Wat we deden":
          "De kap is schoongemaakt, hersteld waar het hout dat nodig had en " +
          "geschilderd. Beschrijf hier de details van het herstelwerk.",
        "Obstakels":
          "Beschrijf hier de obstakels: houtrot, oude reparaties, stof…",
        "Onze keuzes":
          "Beschrijf hier waarom jullie de kap in het zicht hebben gelaten en " +
          "welke afwerking jullie kozen."
      },
      hotspots: []
    },
    {
      id: "hal",
      name: "Hal",
      tagline: "De verbinding tussen alle ruimtes",
      before: "images/hal-voor.svg",
      after: "images/hal-na.svg",
      tabs: {
        "Wat we deden": "Beschrijf hier wat er in de hal is gedaan.",
        "Obstakels": "Beschrijf hier de obstakels in de hal.",
        "Onze keuzes": "Beschrijf hier de keuzes voor de hal."
      },
      hotspots: []
    },
    {
      id: "entree",
      name: "Entree",
      tagline: "De eerste indruk",
      before: "images/entree-voor.svg",
      after: "images/entree-na.svg",
      tabs: {
        "Wat we deden": "Beschrijf hier wat er bij de entree is gedaan.",
        "Obstakels": "Beschrijf hier de obstakels bij de entree.",
        "Onze keuzes": "Beschrijf hier de keuzes voor de entree."
      },
      hotspots: []
    }
  ],

  /* =========================================================================
     DE VERBOUWING IN CIJFERS — grappige statistieken
     Pas de aantallen (value) aan naar de echte cijfers. "suffix" is
     optioneel (bijv. "+" of "%").
     ========================================================================= */
  funStats: {
    kicker: "De verbouwing in cijfers",
    title: "Wat er zoal doorheen ging",
    text: "Een verbouwing meet je niet alleen in maanden — dit ging er " +
          "allemaal doorheen. (Tellingen bij benadering. Soort van.)",
    items: [
      { value: 350,   label: "Zakken puin weggebracht" },
      { value: 42,    label: "Keer naar de RAD geweest" },
      { value: 1250,  label: "Koppen koffie gedronken" },
      { value: 95,    label: "Liters verf gebruikt" },
      { value: 800,   label: "Meter kabel en leiding getrokken" },
      { value: 12500, label: "Schroeven en spijkers verwerkt" },
      { value: 52,    label: "Zaterdagen geklust" },
      { value: 99,    label: "Keer “bijna klaar” gezegd", suffix: "+" }
    ]
  },

  gallery: {
    kicker: "Galerij",
    title: "De verbouwing in beeld",
    text: "Filter op fase of klik op een foto om hem groot te bekijken.",
    items: [
      { src: "images/woonkamer-voor.svg",     caption: "Woonkamer bij aankoop",        phase: "voor" },
      { src: "images/keuken-voor.svg",        caption: "De oude keuken",               phase: "voor" },
      { src: "images/dak-voor.svg",           caption: "Het dak vóór het herstel",     phase: "voor" },
      { src: "images/tijdens-1.svg",          caption: "Gestript tot op het casco",    phase: "tijdens" },
      { src: "images/tijdens-2.svg",          caption: "Werk aan de vloer",            phase: "tijdens" },
      { src: "images/tijdens-3.svg",          caption: "Isolatie en installaties",     phase: "tijdens" },
      { src: "images/tijdens-4.svg",          caption: "De afbouw",                    phase: "tijdens" },
      { src: "images/woonkamer-na.svg",       caption: "De nieuwe woonkamer",          phase: "na" },
      { src: "images/keuken-na.svg",          caption: "De nieuwe keuken",             phase: "na" },
      { src: "images/badkamer-na.svg",        caption: "De nieuwe badkamer",           phase: "na" },
      { src: "images/dak-na.svg",             caption: "Het dak, hersteld en geschilderd", phase: "na" },
      { src: "images/slaapkamer-na.svg",      caption: "De nieuwe slaapkamer",         phase: "na" }
    ]
  },

  footer: {
    title: "Volg het hele verhaal op Instagram",
    text: "De volledige verbouwing — van de eerste sloopdag tot de laatste " +
          "likje verf — is te volgen op ons Instagram-account.",
    note: "Pand uit 1780 · Oude centrum van Oud-Beijerland · Met liefde verbouwd"
  },

  /* =========================================================================
     INSTAGRAM-POSTS — een selectie posts onder de Instagram-knop
     Per post: de link naar de post op Instagram (url), een afbeelding
     (bijv. een screenshot of dezelfde foto als in de post) en een korte
     titel. Voeg gerust meer posts toe.
     ========================================================================= */
  instaPosts: {
    text: "Een paar hoogtepunten uit de verbouwing — klik op een post om hem " +
          "op Instagram te bekijken.",
    items: [
      { url: "https://www.instagram.com/huisjeoostvoorstraat/",
        image: "images/insta-1.svg", caption: "De eerste sloopdag" },
      { url: "https://www.instagram.com/huisjeoostvoorstraat/",
        image: "images/insta-2.svg", caption: "Het dak in de verf" },
      { url: "https://www.instagram.com/huisjeoostvoorstraat/",
        image: "images/insta-3.svg", caption: "De nieuwe vloer gaat erin" },
      { url: "https://www.instagram.com/huisjeoostvoorstraat/",
        image: "images/insta-4.svg", caption: "Bijna klaar…" }
    ]
  }
};
