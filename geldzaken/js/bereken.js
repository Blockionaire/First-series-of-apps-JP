/* =====================================================================
   GELDZAKEN — rekenwerk
   =====================================================================
   Alle afgeleide cijfers staan hier bij elkaar: wat komt er binnen, wat
   gaat eruit, hoe vol zit een potje, hoe ver is een spaardoel en wat
   staat er onder de streep.

   Bewust één plek, want anders telt het dashboard net iets anders op
   dan het cijferscherm. Niets hier schrijft iets weg — het rekent
   alleen met wat er in `state` staat.

   Hoe een boeking op een rekening werkt:
     inkomst      → erbij op `rekening`
     uitgave      → eraf van `rekening`
     overboeking  → eraf van `rekening`, erbij op `naarRekening`
     sparen       → hetzelfde, én het potje of doel groeit
     opname       → hetzelfde, én het potje of doel slinkt
   ===================================================================== */

import { maandVan, maandPlus, maandenTussen, maandNu, vandaagISO,
         normaliseer, dagenInMaand, datumInMaand, dagenTot } from "./util.js";

/* ---------------------------------------------------------------
   Ritmes van vaste lasten
   --------------------------------------------------------------- */
export const RITMES = {
  week:      { label: "per week",       maanden: 1 / 4.345 },
  maand:     { label: "per maand",      maanden: 1 },
  kwartaal:  { label: "per kwartaal",   maanden: 3 },
  halfjaar:  { label: "per half jaar",  maanden: 6 },
  jaar:      { label: "per jaar",       maanden: 12 },
};

/* Valt deze vaste last in die maand? Een kwartaalrekening telt alleen
   in de maanden die een veelvoud van drie na de startmaand liggen. */
export function valtInMaand(post, maand) {
  if (post.actief === false) return false;
  const start = post.startMaand || "2000-01";
  if (maand < start) return false;
  if (post.eindMaand && maand > post.eindMaand) return false;

  const stap = RITMES[post.ritme]?.maanden || 1;
  if (stap <= 1) return true;                       // week en maand: elke maand
  return maandenTussen(start, maand) % stap === 0;
}

/* Wat kost deze post gemiddeld per maand? Een jaarpremie van 600 euro
   is 50 euro per maand die je eigenlijk opzij moet zetten. */
export function perMaand(post) {
  const stap = RITMES[post.ritme]?.maanden || 1;
  const bedrag = Number(post.bedrag) || 0;
  return stap < 1 ? bedrag * 4.345 : bedrag / stap;
}

/* De vaste lasten van een maand, met de datum waarop ze afgeschreven
   worden en of ze al geboekt zijn.

   Een boeking hoort bij een vaste last als hij er expliciet aan hangt
   (dat gebeurt bij het afvinken), maar de app herkent het ook zelf:
   dezelfde naam in de omschrijving, of dezelfde categorie met ongeveer
   hetzelfde bedrag. Dat scheelt dubbel werk als je je afschriften
   inleest of "Huur" gewoon met de hand boekt. Elke boeking kan maar bij
   één post horen, anders vinkt één afschrijving twee posten af. */
export function vasteLastenVanMaand(state, maand) {
  const posten = state.terugkerend.filter(p => valtInMaand(p, maand));
  const vanDeMaand = state.transacties.filter(t => maandVan(t.datum) === maand);

  const geboekt = new Map();    // post-id → boeking
  const bezet = new Set();      // boekingen die al aan een post hangen

  for (const t of vanDeMaand) {
    if (t.terugkerendId && !geboekt.has(t.terugkerendId)) {
      geboekt.set(t.terugkerendId, t);
      bezet.add(t.id);
    }
  }

  for (const p of posten) {
    if (geboekt.has(p.id)) continue;
    const naam = normaliseer(p.naam);
    const verwacht = Number(p.bedrag) || 0;

    const kandidaat = vanDeMaand.find(t => {
      if (bezet.has(t.id) || t.terugkerendId) return false;
      if ((t.soort === "inkomst") !== (p.soort === "inkomst")) return false;
      if (t.soort !== "inkomst" && t.soort !== "uitgave") return false;

      const tekst = normaliseer(t.omschrijving);
      const naamKlopt = naam.length > 2 && tekst.length > 2 && (tekst.includes(naam) || naam.includes(tekst));
      const bedragKlopt = Math.abs((Number(t.bedrag) || 0) - verwacht) <= Math.max(2, verwacht * 0.2);
      const categorieKlopt = !!p.categorie && t.categorie === p.categorie;

      return naamKlopt || (categorieKlopt && bedragKlopt);
    });

    if (kandidaat) { geboekt.set(p.id, kandidaat); bezet.add(kandidaat.id); }
  }

  return posten.map(p => {
    const t = geboekt.get(p.id);
    const datum = datumInMaand(maand, p.dag || 1);
    return {
      post: p,
      id: p.id,
      naam: p.naam,
      soort: p.soort || "uitgave",
      categorie: p.categorie,
      bedrag: t ? Number(t.bedrag) || 0 : Number(p.bedrag) || 0,
      verwacht: Number(p.bedrag) || 0,
      datum,
      betaald: !!t,
      herkend: !!t && !t.terugkerendId,   // door de app gevonden, niet zelf afgevinkt
      transactie: t || null,
      dagenTot: dagenTot(datum),
    };
  }).sort((a, b) => a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam));
}

/* ---------------------------------------------------------------
   Het maandoverzicht — het hart van de app
   --------------------------------------------------------------- */
export function maandOverzicht(state, maand) {
  const transacties = state.transacties.filter(t => maandVan(t.datum) === maand);
  const vast = vasteLastenVanMaand(state, maand);
  const potjesAan = state.instellingen.potjesAutomatisch !== false;

  const som = lijst => lijst.reduce((s, t) => s + (Number(t.bedrag) || 0), 0);

  const inkomstenGeboekt = som(transacties.filter(t => t.soort === "inkomst"));
  const uitgaven = transacties.filter(t => t.soort === "uitgave");

  /* Een uitgave hoort bij de vaste lasten als hij aan een vaste post
     hangt, óf als de categorie als vaste last is aangemerkt. */
  const vasteCategorieen = new Set(state.categorieen.filter(c => c.vast).map(c => c.id));
  const isVast = t => !!t.terugkerendId || vasteCategorieen.has(t.categorie);

  const vasteUitgaven = uitgaven.filter(isVast);
  const losseUitgaven = uitgaven.filter(t => !isVast(t));

  /* Uitgaven die uit een potje betaald worden drukken niet op deze
     maand: dat geld was in eerdere maanden al opzijgezet. */
  const uitPotje = losseUitgaven.filter(t => t.potje);
  const variabel = losseUitgaven.filter(t => !t.potje);

  const sparenTransacties = transacties.filter(t => t.soort === "sparen");
  const opnames = transacties.filter(t => t.soort === "opname");

  /* Automatische maandstortingen in de potjes. */
  const potjesAutomatisch = potjesAan
    ? state.potjes.filter(p => p.actief !== false && (p.startMaand || "2000-01") <= maand)
        .reduce((s, p) => s + (Number(p.maandelijks) || 0), 0)
    : 0;

  const inkomsten = inkomstenGeboekt;
  const vastTotaal = som(vasteUitgaven);
  const variabelTotaal = som(variabel);
  const potjeTotaal = som(uitPotje);
  const sparenTotaal = som(sparenTransacties);
  const opnameTotaal = som(opnames);

  /* Nog te verwachten: vaste lasten die deze maand nog niet geboekt
     zijn, en vast inkomen dat nog moet komen. */
  const nogTeBetalen = vast.filter(v => !v.betaald && v.soort === "uitgave");
  const nogTeOntvangen = vast.filter(v => !v.betaald && v.soort === "inkomst");
  const verwachtEruit = nogTeBetalen.reduce((s, v) => s + v.verwacht, 0);
  const verwachtErin = nogTeOntvangen.reduce((s, v) => s + v.verwacht, 0);

  const uitgavenTotaal = vastTotaal + variabelTotaal + potjeTotaal;
  const saldo = inkomsten - vastTotaal - variabelTotaal - sparenTotaal - potjesAutomatisch + opnameTotaal;

  /* Wat er nog te besteden is als alles wat nog komt ook gebeurt. */
  const vrijTeBesteden = saldo - verwachtEruit + verwachtErin;

  /* Prognose: het huidige uitgeeftempo doorgetrokken naar het eind van
     de maand. Alleen zinvol voor de maand waar we nu in zitten. */
  const dagen = dagenInMaand(maand);
  const isDezeMaand = maand === maandNu();
  const dagNu = isDezeMaand ? Number(vandaagISO().slice(8, 10)) : dagen;
  const perDag = dagNu > 0 ? variabelTotaal / dagNu : 0;
  const prognoseVariabel = isDezeMaand ? perDag * dagen : variabelTotaal;
  const prognoseSaldo = isDezeMaand
    ? inkomsten + verwachtErin - vastTotaal - verwachtEruit - prognoseVariabel - sparenTotaal - potjesAutomatisch + opnameTotaal
    : saldo;

  return {
    maand, transacties, vast,
    inkomsten, verwachtErin,
    vastTotaal, verwachtEruit,
    variabelTotaal, potjeTotaal, sparenTotaal, opnameTotaal, potjesAutomatisch,
    uitgavenTotaal,
    apart: sparenTotaal + potjesAutomatisch,
    saldo, vrijTeBesteden,
    perDag, prognoseVariabel, prognoseSaldo,
    dagenOver: isDezeMaand ? Math.max(0, dagen - dagNu) : 0,
    isDezeMaand,
    spaarquote: inkomsten > 0 ? (sparenTotaal + potjesAutomatisch + Math.max(0, saldo)) / inkomsten : 0,
    lijsten: { vasteUitgaven, variabel, uitPotje, sparenTransacties, opnames },
  };
}

/* Uitgaven per categorie in een maand, met budget en voortgang. */
export function perCategorie(state, maand, { soort = "uitgave" } = {}) {
  const totalen = new Map();
  for (const t of state.transacties) {
    if (maandVan(t.datum) !== maand) continue;
    if (t.soort !== soort) continue;
    const sleutel = t.categorie || "cat-overig";
    totalen.set(sleutel, (totalen.get(sleutel) || 0) + (Number(t.bedrag) || 0));
  }

  return [...totalen.entries()]
    .map(([id, bedrag]) => {
      const cat = state.categorieen.find(c => c.id === id);
      return {
        id,
        naam: cat?.naam || "Zonder categorie",
        icoon: cat?.icoon || "▫️",
        kleur: cat?.kleur || "#8b98a9",
        budget: cat?.budget || null,
        bedrag,
      };
    })
    .sort((a, b) => b.bedrag - a.bedrag);
}

/* Alleen de categorieën waar een budget op staat, met hoe vol ze zitten. */
export function budgetten(state, maand) {
  const uitgaven = perCategorie(state, maand);
  return state.categorieen
    .filter(c => c.budget > 0)
    .map(c => {
      const gebruikt = uitgaven.find(u => u.id === c.id)?.bedrag || 0;
      return {
        ...c,
        gebruikt,
        over: c.budget - gebruikt,
        deel: c.budget > 0 ? gebruikt / c.budget : 0,
      };
    })
    .sort((a, b) => b.deel - a.deel);
}

/* ---------------------------------------------------------------
   Potjes
   ---------------------------------------------------------------
   Een potje is geen echte rekening maar een envelop: elke maand gaat er
   een bedrag in en het geld heeft daarmee een bestemming.

   Er zijn drie soorten, en het verschil zit hem in wat je wilt weten:

     vast    De hypotheek, de energierekening. Dat geld is elke maand
             weg en daar valt niets aan bij te houden. Een saldo zou
             hier alleen maar verwarren, dus dat is altijd nul.
     sparen  Vakantie, buffer, auto-onderhoud. Hier telt juist wat er
             in de loop van de maanden is opgebouwd.
     vrij    Boodschappen, uitgaan. Bedoeld om op te maken. Wat telt is
             wat er déze maand nog over is — en alleen als je boekt.

   Zo kun je op hoofdlijnen bijhouden waar je geld heen gaat zonder
   elke uitgave in te voeren, en toch precies zijn waar dat helpt.
   --------------------------------------------------------------- */
export const POTSOORTEN = {
  vast: {
    label: "Vaste last", meervoud: "Vaste lasten",
    uitleg: "Gaat er elke maand af. Niets bij te houden.",
    kleur: "var(--sparen)", icoon: "🏠",
  },
  vrij: {
    label: "Vrij te besteden", meervoud: "Vrij te besteden",
    uitleg: "Om op te maken. Je ziet wat er deze maand nog over is.",
    kleur: "var(--potje)", icoon: "🛒",
  },
  sparen: {
    label: "Sparen", meervoud: "Sparen",
    uitleg: "Bouwt op. Het saldo blijft staan.",
    kleur: "var(--accent)", icoon: "🐖",
  },
};

export const potSoort = potje => POTSOORTEN[potje?.soort] ? potje.soort : "sparen";

/* ---------------------------------------------------------------
   Wat er uit de boodschappenapp binnenkomt
   ---------------------------------------------------------------
   Een spiegel, geen kopie: deze bedragen staan niet als boeking in
   Geldzaken. Ze tellen daarom mee bij het potje waaraan je ze hangt —
   daar wil je immers zien wat er nog over is — maar niet in de
   maandtotalen, zodat er niets dubbel telt als je daarnaast je
   bankafschrift inleest.
   --------------------------------------------------------------- */
export function externeUitgaven(state, maand = maandNu()) {
  const koppeling = state.instellingen.koppeling || {};
  const bonnen = koppeling.aan
    ? (state.extern?.bonnen || []).filter(b => maandVan(b.datum) === maand)
    : [];
  return {
    aan: !!koppeling.aan,
    potje: koppeling.potje || "",
    bonnen,
    aantal: bonnen.length,
    totaal: bonnen.reduce((s, b) => s + (Number(b.bedrag) || 0), 0),
  };
}

/* Hoeveel van dat externe bedrag hoort bij dít potje? */
function externVoorPotje(state, potjeId, maand) {
  const extern = externeUitgaven(state, maand);
  return extern.aan && extern.potje === potjeId ? extern.totaal : 0;
}

export function potSaldo(state, potje, totMaand = maandNu()) {
  const soort = potSoort(potje);
  const maandbedrag = Number(potje.maandelijks) || 0;
  const extern = externVoorPotje(state, potje.id, totMaand);

  /* Wat er in deze ene maand aan dit potje geboekt is. */
  let ditGestort = 0, ditUit = 0;
  let erbij = 0, eraf = 0;
  for (const t of state.transacties) {
    if (t.potje !== potje.id) continue;
    const maand = maandVan(t.datum);
    if (maand > totMaand) continue;
    const bedrag = Number(t.bedrag) || 0;
    const erin = t.soort === "sparen";
    const eruit = t.soort === "opname" || t.soort === "uitgave";
    if (erin) erbij += bedrag;
    else if (eruit) eraf += bedrag;
    if (maand === totMaand) {
      if (erin) ditGestort += bedrag;
      else if (eruit) ditUit += bedrag;
    }
  }
  ditUit += extern;

  /* Een vaste last is elke maand weg: geen saldo, wel een maandbedrag. */
  if (soort === "vast") {
    return {
      soort, maandbedrag, saldo: 0, automatisch: maandbedrag,
      gestort: 0, opgenomen: 0, maandenGevuld: 0, deel: null,
      ditUit, ditOver: 0, extern, verbruikt: true,
    };
  }

  /* Een vrij potje kijkt alleen naar deze maand. */
  if (soort === "vrij") {
    const over = maandbedrag + ditGestort - ditUit;
    return {
      soort, maandbedrag, saldo: over, automatisch: maandbedrag,
      gestort: ditGestort, opgenomen: ditUit, maandenGevuld: 1,
      deel: maandbedrag > 0 ? ditUit / maandbedrag : null,
      ditUit, ditOver: over, extern, verbruikt: false,
    };
  }

  /* En een spaarpotje telt op vanaf de startmaand. */
  const automatischAan = state.instellingen.potjesAutomatisch !== false && potje.actief !== false;
  const start = potje.startMaand || maandNu();
  const maanden = automatischAan ? Math.max(0, maandenTussen(start, totMaand) + 1) : 0;
  const automatisch = maanden * maandbedrag;
  const saldo = automatisch + erbij - eraf;

  return {
    soort, maandbedrag, saldo, automatisch,
    gestort: erbij,
    opgenomen: eraf,
    maandenGevuld: maanden,
    deel: potje.doelBedrag > 0 ? saldo / potje.doelBedrag : null,
    ditUit, ditOver: null, extern, verbruikt: false,
  };
}

export const potjesMetSaldo = (state, totMaand = maandNu()) =>
  state.potjes
    .map(p => ({ ...p, ...potSaldo(state, p, totMaand) }))
    .sort((a, b) => (a.volgorde ?? 99) - (b.volgorde ?? 99) || a.naam.localeCompare(b.naam));

/* ---------------------------------------------------------------
   De verdeling — het hart van het overzicht
   ---------------------------------------------------------------
   Eén vraag: er komt X binnen, waar gaat dat heen? Elk potje is een
   stuk van de taart, en wat je niet hebt verdeeld blijft over.

   Vaste lasten die je als aparte post hebt ingevoerd tellen als één
   extra stuk mee. Zo klopt de taart ook als je beide manieren door
   elkaar gebruikt, zonder iets dubbel te tellen — het zijn immers
   verschillende dingen.
   --------------------------------------------------------------- */
export function verdeling(state, maand = maandNu()) {
  const o = maandOverzicht(state, maand);
  const inkomen = o.inkomsten + o.verwachtErin;

  /* Een potje dat je pas in augustus hebt aangemaakt hoort niet in de
     taart van juli te staan. */
  const potjes = state.potjes
    .filter(p => p.actief !== false && (p.startMaand || "2000-01") <= maand)
    .map(p => {
      const stand = potSaldo(state, p, maand);
      return {
        id: p.id,
        potje: p,
        naam: p.naam,
        icoon: p.icoon || POTSOORTEN[stand.soort].icoon,
        kleur: p.kleur || POTSOORTEN[stand.soort].kleur,
        soort: stand.soort,
        bedrag: stand.maandbedrag,
        stand,
      };
    })
    .sort((a, b) => b.bedrag - a.bedrag || a.naam.localeCompare(b.naam));

  const posten = [...potjes];

  /* Los ingevoerde vaste lasten als één stuk erbij. */
  const losseVasteLasten = vasteLastenPerMaand(state);
  if (losseVasteLasten > 0) {
    posten.push({
      id: "vaste-lasten",
      naam: "Vaste lasten",
      icoon: "🔁",
      kleur: "var(--sparen)",
      soort: "vast",
      bedrag: losseVasteLasten,
      route: "#/vast",
    });
  }

  const somVan = soort => posten.filter(p => p.soort === soort).reduce((s, p) => s + p.bedrag, 0);
  const verdeeld = posten.reduce((s, p) => s + p.bedrag, 0);

  return {
    maand, inkomen, posten, potjes,
    vast: somVan("vast"),
    sparen: somVan("sparen"),
    vrij: somVan("vrij"),
    verdeeld,
    over: inkomen - verdeeld,
    volledigVerdeeld: inkomen > 0 && Math.abs(inkomen - verdeeld) < 1,
    teveel: verdeeld > inkomen,
    gespaard: potjes.filter(p => p.soort === "sparen").reduce((s, p) => s + p.stand.saldo, 0),
  };
}

/* ---------------------------------------------------------------
   Spaardoelen
   --------------------------------------------------------------- */
export function doelStand(state, doel) {
  let ingelegd = 0;
  for (const t of state.transacties) {
    if (t.doel !== doel.id) continue;
    const bedrag = Number(t.bedrag) || 0;
    if (t.soort === "sparen") ingelegd += bedrag;
    else if (t.soort === "opname" || t.soort === "uitgave") ingelegd -= bedrag;
  }
  const huidig = (Number(doel.startBedrag) || 0) + ingelegd;
  const doelBedrag = Number(doel.doelBedrag) || 0;
  const teGaan = Math.max(0, doelBedrag - huidig);

  /* Hoeveel moet er nog per maand bij om het op tijd te halen? */
  let maandenTeGaan = null, perMaandNodig = null, verwachtKlaar = null;
  if (doel.streefDatum) {
    maandenTeGaan = Math.max(0, maandenTussen(maandNu(), maandVan(doel.streefDatum)));
    perMaandNodig = maandenTeGaan > 0 ? teGaan / maandenTeGaan : teGaan;
  }
  /* Of, andersom: haal je het met het huidige tempo? */
  const tempo = gemiddeldeInlegPerMaand(state, doel);
  if (tempo > 0 && teGaan > 0) {
    verwachtKlaar = maandPlus(maandNu(), Math.ceil(teGaan / tempo));
  } else if (teGaan === 0) {
    verwachtKlaar = maandNu();
  }

  return {
    huidig, doelBedrag, teGaan,
    deel: doelBedrag > 0 ? Math.min(1, huidig / doelBedrag) : 0,
    klaar: doelBedrag > 0 && huidig >= doelBedrag,
    maandenTeGaan, perMaandNodig, tempo, verwachtKlaar,
  };
}

function gemiddeldeInlegPerMaand(state, doel) {
  const perMaandTotaal = new Map();
  for (const t of state.transacties) {
    if (t.doel !== doel.id || t.soort !== "sparen") continue;
    const m = maandVan(t.datum);
    perMaandTotaal.set(m, (perMaandTotaal.get(m) || 0) + (Number(t.bedrag) || 0));
  }
  if (!perMaandTotaal.size) return 0;
  const maanden = [...perMaandTotaal.keys()].sort();
  const spanne = Math.max(1, maandenTussen(maanden[0], maandNu()) + 1);
  const totaal = [...perMaandTotaal.values()].reduce((s, v) => s + v, 0);
  return totaal / spanne;
}

export const doelenMetStand = state =>
  state.doelen
    .map(d => ({ ...d, ...doelStand(state, d) }))
    .sort((a, b) => Number(a.klaar) - Number(b.klaar) || (a.streefDatum || "9999").localeCompare(b.streefDatum || "9999"));

/* ---------------------------------------------------------------
   Rekeningen en vermogen
   --------------------------------------------------------------- */
export function rekeningSaldo(state, rekeningId, totDatum = null) {
  const rek = state.rekeningen.find(r => r.id === rekeningId);
  let saldo = Number(rek?.beginsaldo) || 0;

  for (const t of state.transacties) {
    if (totDatum && t.datum > totDatum) continue;
    const bedrag = Number(t.bedrag) || 0;
    if (t.rekening === rekeningId) {
      saldo += t.soort === "inkomst" ? bedrag : -bedrag;
    }
    if (t.naarRekening === rekeningId && t.soort !== "inkomst") {
      saldo += bedrag;
    }
  }
  return saldo;
}

export const rekeningenMetSaldo = (state, totDatum = null) =>
  state.rekeningen
    .map(r => ({ ...r, saldo: rekeningSaldo(state, r.id, totDatum) }))
    .sort((a, b) => (a.volgorde ?? 99) - (b.volgorde ?? 99));

export function vermogen(state, totDatum = null) {
  return state.rekeningen
    .filter(r => r.telMee !== false)
    .reduce((s, r) => {
      const saldo = rekeningSaldo(state, r.id, totDatum);
      /* Een schuld of creditcard telt negatief mee. */
      return s + (r.soort === "schuld" ? -Math.abs(saldo) : saldo);
    }, 0);
}

export function vermogenVerloop(state, aantalMaanden = 12) {
  const punten = [];
  for (let i = aantalMaanden - 1; i >= 0; i--) {
    const maand = maandPlus(maandNu(), -i);
    const eind = `${maand}-${String(dagenInMaand(maand)).padStart(2, "0")}`;
    punten.push({ maand, waarde: vermogen(state, eind) });
  }
  return punten;
}

/* ---------------------------------------------------------------
   Reeksen over meerdere maanden
   --------------------------------------------------------------- */
export function maandReeks(state, aantal = 12, tot = maandNu()) {
  const reeks = [];
  for (let i = aantal - 1; i >= 0; i--) {
    const maand = maandPlus(tot, -i);
    let erin = 0, eruit = 0, apart = 0;
    for (const t of state.transacties) {
      if (maandVan(t.datum) !== maand) continue;
      const bedrag = Number(t.bedrag) || 0;
      if (t.soort === "inkomst") erin += bedrag;
      else if (t.soort === "uitgave") eruit += bedrag;
      else if (t.soort === "sparen") apart += bedrag;
      else if (t.soort === "opname") apart -= bedrag;
    }
    reeks.push({ maand, in: erin, uit: eruit, apart, saldo: erin - eruit - apart });
  }
  return reeks;
}

/* Gemiddelde uitgaven per maand over de afgelopen maanden — nuttig om
   te zien of deze maand meevalt of tegenvalt. */
export function gemiddelden(state, aantal = 6) {
  const reeks = maandReeks(state, aantal + 1).slice(0, aantal);   // deze maand niet meetellen
  const gevuld = reeks.filter(m => m.in > 0 || m.uit > 0);
  if (!gevuld.length) return { in: 0, uit: 0, saldo: 0, maanden: 0 };
  const deel = (sleutel) => gevuld.reduce((s, m) => s + m[sleutel], 0) / gevuld.length;
  return { in: deel("in"), uit: deel("uit"), saldo: deel("saldo"), maanden: gevuld.length };
}

/* ---------------------------------------------------------------
   Wat komt eraan
   ---------------------------------------------------------------
   De eerstvolgende afschrijvingen, ook als die net in de volgende maand
   vallen. Hiermee waarschuwt het dashboard op tijd.
   --------------------------------------------------------------- */
export function aankomend(state, dagen = 14) {
  const uit = [];
  for (const maand of [maandNu(), maandPlus(maandNu(), 1)]) {
    for (const post of vasteLastenVanMaand(state, maand)) {
      if (post.betaald) continue;
      const overDagen = dagenTot(post.datum);
      if (overDagen < -3 || overDagen > dagen) continue;
      uit.push({ ...post, overDagen, telaat: overDagen < 0 });
    }
  }
  return uit.sort((a, b) => a.datum.localeCompare(b.datum));
}

/* ---------------------------------------------------------------
   Signalen voor het dashboard
   ---------------------------------------------------------------
   Korte, concrete opmerkingen. Alleen tonen wat je nú kunt gebruiken —
   een scherm vol waarschuwingen leest niemand meer.
   --------------------------------------------------------------- */
export function signalen(state, maand) {
  const uit = [];
  const o = maandOverzicht(state, maand);

  if (o.isDezeMaand && o.prognoseSaldo < 0) {
    uit.push({
      soort: "let-op",
      icoon: "⚠️",
      titel: "Je komt deze maand tekort",
      tekst: `Met dit tempo eindig je rond ${Math.round(o.prognoseSaldo)} euro. Kijk even naar je losse uitgaven.`,
    });
  }

  const telaat = aankomend(state, 0).filter(p => p.telaat && p.soort !== "inkomst");
  if (telaat.length) {
    uit.push({
      soort: "fout",
      icoon: "⏰",
      titel: telaat.length === 1 ? "Eén vaste last staat nog open" : `${telaat.length} vaste lasten staan nog open`,
      tekst: telaat.map(p => p.naam).slice(0, 3).join(", "),
    });
  }

  for (const b of budgetten(state, maand)) {
    if (b.deel > 1) {
      uit.push({
        soort: "fout", icoon: b.icoon,
        titel: `${b.naam} is over het budget`,
        tekst: `${Math.round(b.gebruikt)} van ${Math.round(b.budget)} euro.`,
      });
    } else if (b.deel >= 0.85 && o.isDezeMaand) {
      uit.push({
        soort: "let-op", icoon: b.icoon,
        titel: `${b.naam} is bijna op`,
        tekst: `Nog ${Math.round(b.over)} euro over deze maand.`,
      });
    }
  }

  const negatief = potjesMetSaldo(state).filter(p => p.saldo < 0);
  if (negatief.length) {
    uit.push({
      soort: "let-op", icoon: "🫗",
      titel: negatief.length === 1 ? `Potje ${negatief[0].naam} staat rood` : `${negatief.length} potjes staan rood`,
      tekst: "Er is meer uit gehaald dan erin zat.",
    });
  }

  const gem = gemiddelden(state, 6);
  if (gem.maanden >= 3 && o.isDezeMaand && o.variabelTotaal > gem.uit * 1.25 && o.variabelTotaal > 100) {
    uit.push({
      soort: "info", icoon: "📈",
      titel: "Duurdere maand dan normaal",
      tekst: `Je gaf tot nu toe ${Math.round(o.variabelTotaal)} euro los uit, gemiddeld is dat ${Math.round(gem.uit)}.`,
    });
  }

  return uit.slice(0, 4);
}

/* ---------------------------------------------------------------
   Wat je maandelijks opzij zou moeten zetten
   ---------------------------------------------------------------
   Kwartaal- en jaarrekeningen komen altijd op een verkeerd moment. Dit
   rekent uit wat ze samen per maand kosten.
   --------------------------------------------------------------- */
export function reserveringPerMaand(state) {
  const posten = state.terugkerend.filter(p => p.actief !== false && p.soort !== "inkomst" && (RITMES[p.ritme]?.maanden || 1) > 1);
  const totaal = posten.reduce((s, p) => s + perMaand(p), 0);
  return { posten, totaal };
}

/* Alle vaste lasten samen, omgerekend naar een maandbedrag. */
export function vasteLastenPerMaand(state) {
  return state.terugkerend
    .filter(p => p.actief !== false && p.soort !== "inkomst")
    .reduce((s, p) => s + perMaand(p), 0);
}

export function vastInkomenPerMaand(state) {
  return state.terugkerend
    .filter(p => p.actief !== false && p.soort === "inkomst")
    .reduce((s, p) => s + perMaand(p), 0);
}
