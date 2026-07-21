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
    before: "images/hero-voor.jpg",
    after: "images/hero-na.jpg"
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
        image: "images/tl-0.jpg"
      },
      {
        period: "Fase 1",
        title: "Strippen tot casco",
        text: "Alles eruit: wanden, plafonds, vloeren en installaties. Terug tot " +
              "de kale constructie, zodat we konden zien waar we echt mee te " +
              "maken hadden.",
        image: "images/tl-1.jpg"
      },
      {
        period: "Fase 2",
        title: "Nieuwe indeling realiseren",
        text: "De nieuwe wanden gingen omhoog, precies zoals uitgetekend in " +
              "fase 0. De oude, onlogische indeling maakte plaats voor een plan " +
              "dat past bij hoe we nu wonen.",
        image: "images/tl-2.jpg"
      },
      {
        period: "Fase 3",
        title: "Nieuwe vloer & vloerverwarming",
        text: "De aflopende vloer eruit en een nieuwe, vlakke vloer erin — " +
              "compleet met vloerverwarming door het hele appartement.",
        image: "images/tl-3.jpg"
      },
      {
        period: "Fase 4",
        title: "Volledige appartement isoleren",
        text: "Van totaal niet geïsoleerd naar volledig ingepakt: dak, wanden " +
              "en vloer. Het verschil in comfort (en stookkosten) is enorm.",
        image: "images/tl-4.jpg"
      },
      {
        period: "Fase 5",
        title: "Vervanging buitenkant dak",
        text: "De buitenkant van het dak is volledig vervangen, terwijl de " +
              "originele kapconstructie uit 1780 binnen in het zicht bleef.",
        image: "images/tl-5.jpg"
      },
      {
        period: "Fase 6",
        title: "Afwerking (stucen/schilderen/eindvloer)",
        text: "Stucwerk op de wanden, schilderwerk door het hele huis en de " +
              "eindvloer erin. De fase waarin het van bouwplaats een thuis werd.",
        image: "images/tl-6.jpg"
      },
      {
        period: "Fase 7",
        title: "Afmonteren badkamer, toilet en keuken",
        text: "Sanitair, toilet en keuken geplaatst en aangesloten — de " +
              "momenten waarop alles ineens écht af begint te voelen.",
        image: "images/tl-7.jpg"
      },
      {
        period: "Fase 8",
        title: "Inrichting & styling",
        text: "Meubels, verlichting, gordijnen en de laatste details. Het " +
              "sluitstuk van acht maanden verbouwen.",
        image: "images/tl-8.jpg"
      }
    ]
  },

  /* =========================================================================
     MAAND VOOR MAAND — de scrubber: klik of sleep door de maanden heen.
     Pas de maanden, teksten, hoogtepunten en foto's hieronder aan.
     ========================================================================= */
  months: {
    kicker: "Maand voor maand",
    title: "Tien maanden in vogelvlucht",
    text: "Klik op een maand of sleep door de balk — per maand zie je wat er " +
          "toen gebeurde.",
    items: [
      {
        label: "Oktober", year: "2025",
        title: "Renders, plan & bod",
        text: "Het begon achter de laptop: heel veel 3D-renderingen, een " +
              "compleet verbouwplan en budget. En toen: bezichtigen, bod " +
              "uitbrengen — geaccepteerd!",
        highlights: ["Heel veel 3D-renderingen gemaakt", "Verbouwplan en budget opgesteld", "Bezichtigd, bod uitgebracht en geaccepteerd"],
        image: "images/maand-01.jpg"
      },
      {
        label: "November", year: "2025",
        title: "Keuken & badkamer kiezen",
        text: "Nog geen sleutel, wel al keuzes: de keuken en de badkamer " +
              "werden deze maand uitgezocht.",
        highlights: ["Keuken uitgekozen", "Badkamer uitgekozen"],
        image: "images/maand-02.jpg"
      },
      {
        label: "December", year: "2025",
        title: "De sleutel & de sloop",
        text: "Sleutel gekregen, snel de before-beelden vastgelegd en " +
              "diezelfde periode nog begonnen met strippen.",
        highlights: ["Sleutel gekregen", "Before-beelden gemaakt", "Direct gestart met strippen"],
        image: "images/maand-03.jpg"
      },
      {
        label: "Januari", year: "2026",
        title: "Gestript & gestart met de indeling",
        text: "Het appartement werd volledig gestript tot het casco, en de " +
              "eerste wanden van de nieuwe indeling gingen omhoog.",
        highlights: ["Appartement volledig gestript", "Gestart met de nieuwe indeling"],
        image: "images/maand-04.jpg"
      },
      {
        label: "Februari", year: "2026",
        title: "Indeling af & techniek erin",
        text: "De nieuwe indeling werd afgemaakt en alle techniek kwam op zijn " +
              "plek: elektra, leidingwerk, de eerste isolatie en een nieuwe " +
              "ondervloer.",
        highlights: ["Nieuwe indeling afgemaakt", "Nieuwe elektra en leidingwerk aangelegd", "Gestart met isoleren", "Nieuwe ondervloer gestort"],
        image: "images/maand-05.jpg"
      },
      {
        label: "Maart", year: "2026",
        title: "Dak isoleren & badkamer betegelen",
        text: "Boven werd het hele dak geïsoleerd, beneden kreeg de badkamer " +
              "zijn tegels.",
        highlights: ["Hele dak geïsoleerd", "Badkamer betegeld"],
        image: "images/maand-06.jpg"
      },
      {
        label: "April", year: "2026",
        title: "Gipsplaten & een nieuw dak",
        text: "Alle wanden en het dak kregen gips- en stucplaten. Buiten werd " +
              "het dak volledig gestript en voorzien van folie, nieuwe " +
              "panlatten en dakpannen.",
        highlights: ["Wanden en dak voorzien van gips-/stucplaten", "Buitenkant dak volledig gestript", "Folie, panlatten en nieuwe dakpannen aangebracht"],
        image: "images/maand-07.jpg"
      },
      {
        label: "Mei", year: "2026",
        title: "Stucwerk & dakramen",
        text: "Het volledige appartement werd gestuct, de trap dichtgemaakt " +
              "en de twee nieuwe dakramen geplaatst.",
        highlights: ["Volledige appartement gestuct", "Trap dichtgemaakt", "Twee nieuwe dakramen geplaatst"],
        image: "images/maand-08.jpg"
      },
      {
        label: "Juni", year: "2026",
        title: "Keuken, vloer, verf & behang",
        text: "De grote afbouwmaand: keuken opgehaald en in elkaar gezet, " +
              "PVC-vloer geplakt, stopcontacten geplaatst, sierlijsten om de " +
              "deurposten en alles geschilderd. Het behang kwam in de " +
              "slaapkamer en het toilet, en de eerste meubels werden geleverd.",
        highlights: ["Keuken opgehaald en in elkaar gezet", "PVC-vloer geplakt", "Stopcontacten geplaatst", "Sierlijsten en al het schilderwerk", "Behang in slaapkamer en toilet", "Eerste meubels geleverd"],
        image: "images/maand-09.jpg"
      },
      {
        label: "Juli", year: "2026",
        title: "De laatste loodjes",
        text: "Afwerkklusjes overal: deurbeslag, kastjes, de kledingkast en " +
              "het bed. De buitendeur werd opgeknapt en geverfd en de keuken " +
              "gemonteerd. Daarna alles het huis in, schoongemaakt en " +
              "ingericht — klaar.",
        highlights: ["Deurbeslag, kastjes, kledingkast en bed", "Buitendeur opgeknapt en geverfd", "Keuken gemonteerd", "Schoongemaakt en volledig ingericht"],
        image: "images/maand-10.jpg"
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
      before: "images/woonkamer-voor.jpg",
      during: "images/woonkamer-tijdens.jpg",   /* weghalen = gewone voor/na-schuif */
      after: "images/woonkamer-na.jpg",
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
      before: "images/keuken-voor.jpg",
      during: "images/keuken-tijdens.jpg",   /* weghalen = gewone voor/na-schuif */
      after: "images/keuken-na.jpg",
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
      before: "images/badkamer-voor.jpg",
      during: "images/badkamer-tijdens.jpg",   /* weghalen = gewone voor/na-schuif */
      after: "images/badkamer-na.jpg",
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
      before: "images/slaapkamer-voor.jpg",
      during: "images/slaapkamer-tijdens.jpg",   /* weghalen = gewone voor/na-schuif */
      after: "images/slaapkamer-na.jpg",
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
      before: "images/dak-voor.jpg",
      during: "images/dak-tijdens.jpg",   /* weghalen = gewone voor/na-schuif */
      after: "images/dak-na.jpg",
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
      before: "images/hal-voor.jpg",
      during: "images/hal-tijdens.jpg",   /* weghalen = gewone voor/na-schuif */
      after: "images/hal-na.jpg",
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
      before: "images/entree-voor.jpg",
      during: "images/entree-tijdens.jpg",   /* weghalen = gewone voor/na-schuif */
      after: "images/entree-na.jpg",
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
          { src: "images/gal-voor-1.jpg",  caption: "Woonkamer bij aankoop" },
          { src: "images/gal-voor-2.jpg",     caption: "De oude keuken" },
          { src: "images/gal-voor-3.jpg",  caption: "De oude badkamer" },
          { src: "images/gal-voor-4.jpg", caption: "De oude slaapkamer" },
          { src: "images/gal-voor-5.jpg",        caption: "Het dak vóór het herstel" },
          { src: "images/gal-voor-6.jpg",        caption: "De oude hal" }
        ]
      },
      {
        label: "Tijdens",
        items: [
          { src: "images/gal-tijdens-1.jpg", caption: "Gestript tot op het casco" },
          { src: "images/gal-tijdens-2.jpg", caption: "De nieuwe indeling gaat omhoog" },
          { src: "images/gal-tijdens-3.jpg", caption: "Nieuwe vloer en vloerverwarming" },
          { src: "images/gal-tijdens-4.jpg", caption: "Isolatie" },
          { src: "images/gal-tijdens-5.jpg", caption: "Het dak wordt vervangen" },
          { src: "images/gal-tijdens-6.jpg", caption: "De afwerking" }
        ]
      },
      {
        label: "Na",
        items: [
          { src: "images/gal-na-1.jpg",  caption: "De nieuwe woonkamer" },
          { src: "images/gal-na-2.jpg",     caption: "De nieuwe keuken" },
          { src: "images/gal-na-3.jpg",  caption: "De nieuwe badkamer" },
          { src: "images/gal-na-4.jpg", caption: "De nieuwe slaapkamer" },
          { src: "images/gal-na-5.jpg",        caption: "Het dak, hersteld en geschilderd" },
          { src: "images/gal-na-6.jpg",     caption: "De nieuwe entree" }
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
