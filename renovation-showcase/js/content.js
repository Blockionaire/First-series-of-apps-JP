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
    name: "Huisje OVS",
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
    { value: 8,    label: "Maanden verbouwd" },
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
        period: "Fase 0",
        title: "Nieuwe indeling uittekenen & 3D-renderingen maken",
        text: "Voordat er ook maar iets gesloopt werd, is de nieuwe indeling " +
              "volledig uitgetekend en in 3D gerenderd. Zo wisten we precies " +
              "waar we naartoe werkten.",
        image: "images/render-3d.svg"
      },
      {
        period: "Fase 1",
        title: "Strippen tot casco",
        text: "Alles eruit: wanden, plafonds, vloeren en installaties. Terug tot " +
              "de kale constructie, zodat we konden zien waar we echt mee te " +
              "maken hadden.",
        image: "images/tijdens-1.svg"
      },
      {
        period: "Fase 2",
        title: "Nieuwe indeling realiseren",
        text: "De nieuwe wanden gingen omhoog, precies zoals uitgetekend in " +
              "fase 0. De oude, onlogische indeling maakte plaats voor een plan " +
              "dat past bij hoe we nu wonen.",
        image: "images/tijdens-2.svg"
      },
      {
        period: "Fase 3",
        title: "Nieuwe vloer & vloerverwarming",
        text: "De aflopende vloer eruit en een nieuwe, vlakke vloer erin — " +
              "compleet met vloerverwarming door het hele appartement.",
        image: "images/tijdens-3.svg"
      },
      {
        period: "Fase 4",
        title: "Volledige appartement isoleren",
        text: "Van totaal niet geïsoleerd naar volledig ingepakt: dak, wanden " +
              "en vloer. Het verschil in comfort (en stookkosten) is enorm.",
        image: "images/tijdens-4.svg"
      },
      {
        period: "Fase 5",
        title: "Vervanging buitenkant dak",
        text: "De buitenkant van het dak is volledig vervangen, terwijl de " +
              "originele kapconstructie uit 1780 binnen in het zicht bleef.",
        image: "images/tijdens-5.svg"
      },
      {
        period: "Fase 6",
        title: "Afwerking (stucen/schilderen/eindvloer)",
        text: "Stucwerk op de wanden, schilderwerk door het hele huis en de " +
              "eindvloer erin. De fase waarin het van bouwplaats een thuis werd.",
        image: "images/tijdens-6.svg"
      },
      {
        period: "Fase 7",
        title: "Afmonteren badkamer, toilet en keuken",
        text: "Sanitair, toilet en keuken geplaatst en aangesloten — de " +
              "momenten waarop alles ineens écht af begint te voelen.",
        image: "images/tijdens-7.svg"
      },
      {
        period: "Fase 8",
        title: "Inrichting & styling",
        text: "Meubels, verlichting, gordijnen en de laatste details. Het " +
              "sluitstuk van acht maanden verbouwen.",
        image: "images/tijdens-8.svg"
      }
    ]
  },

  /* =========================================================================
     PLATTEGROND — klikbare kamers, schuifbaar tussen oude en nieuwe indeling
     Elke kamer: x/y = positie linksboven, w/h = breedte/hoogte, alles in
     procenten van de plattegrond. "room" verwijst naar het id van de ruimte
     hierboven (de klik scrolt daarnaartoe). Vakken ZONDER "room" (zoals de
     kasten) zijn alleen decoratie en niet klikbaar.

     De oude indeling is overgenomen van de originele plattegrond
     (5,40 m breed × 13,94 m lang) en een kwartslag gedraaid zodat hij in
     beeld past: links de voorzijde met de woonkamer, rechts de achterzijde
     met de slaapkamer en badkamer. "aspect" bepaalt de verhouding
     (lengte / breedte van het appartement).
     ========================================================================= */
  floorplan: {
    kicker: "De plattegrond",
    title: "Eén appartement, twee indelingen",
    text: "Sleep de schuif om te zien hoe de indeling veranderde, en klik op " +
          "een ruimte om er direct naartoe te gaan — dat werkt in allebei de " +
          "plattegronden.",
    note: "Naar de originele plattegrond (5,40 × 13,94 m), een kwartslag " +
          "gedraaid: links de voorzijde met de woonkamer, rechts de " +
          "achterzijde met de slaapkamer.",
    aspect: "2.6 / 1",
    labelBefore: "Oude indeling",
    labelAfter: "Nieuwe indeling",
    before: [
      { label: "Kast",                            x: 2,  y: 2,  w: 36, h: 20 },
      { room: "woonkamer",  label: "Woonkamer",   x: 2,  y: 26, w: 36, h: 72 },
      { label: "Kast",                            x: 40, y: 26, w: 5,  h: 30 },
      { label: "Kast",                            x: 47, y: 2,  w: 21, h: 20 },
      { room: "keuken",     label: "Keuken",      x: 47, y: 26, w: 21, h: 48 },
      { label: "Kast",                            x: 47, y: 78, w: 9,  h: 20 },
      { room: "hal",        label: "Gang",        x: 58, y: 78, w: 10, h: 20 },
      { room: "slaapkamer", label: "Slaapkamer",  x: 70, y: 26, w: 28, h: 72 },
      { room: "entree",     label: "Trap",        x: 70, y: 2,  w: 12, h: 20 },
      { room: "badkamer",   label: "Badkamer",    x: 84, y: 2,  w: 14, h: 46 }
    ],
    /* De nieuwe indeling is nog een voorbeeldopzet — pas de vakken aan
       (of stuur de nieuwe plattegrond) zodat hij klopt met de echte situatie. */
    after: [
      { room: "woonkamer",  label: "Woonkamer",   x: 2,  y: 2,  w: 42, h: 96 },
      { room: "keuken",     label: "Keuken",      x: 46, y: 2,  w: 20, h: 44 },
      { room: "badkamer",   label: "Badkamer",    x: 46, y: 50, w: 20, h: 48 },
      { room: "entree",     label: "Entree",      x: 68, y: 2,  w: 12, h: 44 },
      { room: "hal",        label: "Hal",         x: 68, y: 50, w: 12, h: 48 },
      { room: "dak",        label: "Zolder — het dak", x: 82, y: 2, w: 16, h: 20 },
      { room: "slaapkamer", label: "Slaapkamer",  x: 82, y: 26, w: 16, h: 72 }
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
      during: "images/woonkamer-tijdens.svg",   /* weghalen = gewone voor/na-schuif */
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
      during: "images/keuken-tijdens.svg",   /* weghalen = gewone voor/na-schuif */
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
      before: "images/badkamer-voor.jpeg",
      during: "images/badkamer-tijdens.svg",   /* weghalen = gewone voor/na-schuif */
      after: "images/badkamer-na.jpeg",
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
      during: "images/slaapkamer-tijdens.svg",   /* weghalen = gewone voor/na-schuif */
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
      during: "images/dak-tijdens.svg",   /* weghalen = gewone voor/na-schuif */
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
      during: "images/hal-tijdens.svg",   /* weghalen = gewone voor/na-schuif */
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
      during: "images/entree-tijdens.svg",   /* weghalen = gewone voor/na-schuif */
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

  /* =========================================================================
     GALERIJ — drie rijen (voor / tijdens / na) met elk zes foto's.
     Scroll binnen een rij met de pijltjes of door te vegen.
     ========================================================================= */
  gallery: {
    kicker: "Galerij",
    title: "De verbouwing in beeld",
    text: "Zes foto's per fase — scroll met de pijltjes door de rij, of klik " +
          "op een foto om hem groot te bekijken.",
    rows: [
      {
        label: "Voor",
        items: [
          { src: "images/woonkamer-voor.svg",  caption: "Woonkamer bij aankoop" },
          { src: "images/keuken-voor.svg",     caption: "De oude keuken" },
          { src: "images/badkamer-voor.jpeg",  caption: "De oude badkamer" },
          { src: "images/slaapkamer-voor.svg", caption: "De oude slaapkamer" },
          { src: "images/dak-voor.svg",        caption: "Het dak vóór het herstel" },
          { src: "images/hal-voor.svg",        caption: "De oude hal" }
        ]
      },
      {
        label: "Tijdens",
        items: [
          { src: "images/tijdens-1.svg", caption: "Gestript tot op het casco" },
          { src: "images/tijdens-2.svg", caption: "De nieuwe indeling gaat omhoog" },
          { src: "images/tijdens-3.svg", caption: "Nieuwe vloer en vloerverwarming" },
          { src: "images/tijdens-4.svg", caption: "Isolatie" },
          { src: "images/tijdens-5.svg", caption: "Het dak wordt vervangen" },
          { src: "images/tijdens-6.svg", caption: "De afwerking" }
        ]
      },
      {
        label: "Na",
        items: [
          { src: "images/woonkamer-na.svg",  caption: "De nieuwe woonkamer" },
          { src: "images/keuken-na.svg",     caption: "De nieuwe keuken" },
          { src: "images/badkamer-na.jpeg",  caption: "De nieuwe badkamer" },
          { src: "images/slaapkamer-na.svg", caption: "De nieuwe slaapkamer" },
          { src: "images/dak-na.svg",        caption: "Het dak, hersteld en geschilderd" },
          { src: "images/entree-na.svg",     caption: "De nieuwe entree" }
        ]
      }
    ]
  },

  footer: {
    title: "Volg het hele verhaal op Instagram",
    text: "De volledige verbouwing — van de eerste sloopdag tot de laatste " +
          "likje verf — is te volgen op ons Instagram-account.",
    note: "Verbouwing Huisje OVS | 1780 - 2026"
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
      { url: "https://www.instagram.com/p/Daa8fg4jGoKXSdD1EkpaR5ouvnnZJjugoVJEgk0/",
        image: "images/insta-1.svg", caption: "Updates juni" },
      { url: "https://www.instagram.com/p/DXkBmJ9jAscel7GRjkSr164loersyJCiNXu0XE0/",
        image: "images/insta-2.svg", caption: "Meubels uitzoeken" },
      { url: "https://www.instagram.com/p/DVdHjUUjJOwtlFOGKmwJxe49euSD-03jcuw-Q80/",
        image: "images/insta-3.svg", caption: "Keuzes keuken" },
      { url: "https://www.instagram.com/p/DT45ftTDHV6Y-S0lb4u_-nxZye87O7WagZozt00/",
        image: "images/insta-4.svg", caption: "Keuzes keuken" }
    ]
  }
};
