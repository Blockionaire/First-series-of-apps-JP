/* =====================================================================
   GELDZAKEN — vragen stellen over je eigen cijfers
   =====================================================================
   Een vraagbalk die je gegevens doorzoekt op je eigen apparaat. Geen
   model, geen netwerk, geen kosten: hij herkent een handvol vormen
   waarin mensen hun geldvragen stellen en rekent het antwoord uit.

   Waarom zo, en niet meteen een AI? Omdat dit het grootste deel van de
   vragen afvangt, in een oogwenk, offline, en zonder dat er één cijfer
   je telefoon verlaat. Wat hij niet herkent kan alsnog naar een model,
   maar alleen als jij dat hebt aangezet. Zie bank.js en de instellingen.

   De opzet is bewust saai: een lijst herkenners, elk met een paar
   patronen en een functie die het antwoord maakt. Een nieuwe vraagvorm
   toevoegen is één item in die lijst.
   ===================================================================== */

import { normaliseer, geld, maandLabel, maandVan, maandNu, maandPlus, MAANDEN } from "./util.js";
import { state } from "./store.js";
import { potAnalyse, potGeschiedenis, maandOverzicht, verdeling, potSaldo,
         doelenMetStand, externeUitgaven, subpotjesVan, potMaandDetail,
         vermogen, rekeningenMetSaldo, maandReeks, gemiddelden, aankomend,
         signalen, vasteLastenPerMaand, perCategorie, POTSOORTEN,
         heeftSubpotjes, potSoort } from "./bereken.js";

/* ---------------------------------------------------------------
   De vraag ontleden
   --------------------------------------------------------------- */

/* Welke maand bedoelt iemand? "september", "vorige maand", "in mei
   2025", of niets — dan de maand die je op dit moment bekijkt. */
export function leesMaand(vraag) {
  const t = normaliseer(vraag);

  if (/\bvorige maand\b/.test(t)) return { maand: maandPlus(maandNu(), -1), expliciet: true };
  if (/\bdeze maand\b|\bnu\b/.test(t)) return { maand: maandNu(), expliciet: true };
  if (/\bvorig jaar\b/.test(t)) return { jaar: String(Number(maandNu().slice(0, 4)) - 1), expliciet: true };
  if (/\bdit jaar\b/.test(t)) return { jaar: maandNu().slice(0, 4), expliciet: true };

  const jaarIn = t.match(/\b(20\d{2})\b/);
  for (let i = 0; i < MAANDEN.length; i++) {
    const naam = normaliseer(MAANDEN[i]);
    if (new RegExp(`\\b${naam.slice(0, 4)}`).test(t)) {
      const jaar = jaarIn ? jaarIn[1] : maandNu().slice(0, 4);
      const kandidaat = `${jaar}-${String(i + 1).padStart(2, "0")}`;
      /* Zonder jaartal bedoelt iemand de laatste keer dat die maand
         voorbijkwam, niet een maand die nog moet komen. */
      return { maand: (!jaarIn && kandidaat > maandNu())
        ? `${Number(jaar) - 1}-${String(i + 1).padStart(2, "0")}` : kandidaat, expliciet: true };
    }
  }
  if (jaarIn) return { jaar: jaarIn[1], expliciet: true };
  return { maand: state.maand, expliciet: false };
}

/* Noemt iemand een winkel of tegenpartij? "bij Albert Heijn", "van
   Vattenfall". Alleen als het geen potje is — dat gaat voor. */
export function leesTegenpartij(vraag) {
  const m = normaliseer(vraag).match(/\b(?:bij|van)\s+([a-z0-9][a-z0-9 .'&-]{2,30}?)\s*\??$/);
  const naam = (m?.[1] || "").trim();
  if (!naam || /maand|jaar|week|mij|mezelf|plan|budget/.test(naam)) return "";
  return naam;
}

/* Welk potje bedoelt iemand? Op naam, ook als er maar een deel staat. */
export function leesPotje(vraag) {
  const t = normaliseer(vraag);
  const kandidaten = state.potjes
    .map(p => ({ potje: p, naam: normaliseer(p.naam) }))
    .filter(k => k.naam.length > 2 && t.includes(k.naam))
    .sort((a, b) => b.naam.length - a.naam.length);
  return kandidaten[0]?.potje || null;
}

const maandenVan = jaar => Array.from({ length: 12 }, (_, i) => `${jaar}-${String(i + 1).padStart(2, "0")}`)
  .filter(m => m <= maandNu());

/* ---------------------------------------------------------------
   De herkenners
   ---------------------------------------------------------------
   Elke herkenner krijgt de genormaliseerde vraag en geeft een antwoord
   terug, of niets als hij hem niet herkent. Volgorde telt: de eerste
   die iets teruggeeft wint, dus de specifieke staan boven.
   --------------------------------------------------------------- */
const HERKENNERS = [

  /* "wat kan ik vragen" */
  {
    naam: "hulp",
    kan: t => /wat kan ik vragen|wat kun je|wat weet je|^help$|hoe werkt dit|wat snap je/.test(t),
    doe: () => ({
      tekst: "Vraag me naar je uitgaven (per potje, per winkel, per maand of per jaar), " +
        "wat er nog over is, waar je geld heen gaat, je inkomen, je sparen en spaardoelen, " +
        "je vaste lasten, je vermogen, of je binnen je budget blijft, hoe deze maand zich " +
        "verhoudt tot de vorige, en of je het tot het eind van de maand redt.",
      regels: voorbeelden().map(v => ({ naam: v, bedrag: null })),
    }),
  },

  /* "red ik het tot het eind van de maand" */
  {
    naam: "vooruitblik",
    kan: t => /red ik|haal ik het|kom ik (ermee )?uit|houd ik .*over|eind van de maand|rest van de maand|tekort/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const o = maandOverzicht(state, tijd.maand);
      if (!o.isDezeMaand) {
        return zin(`${hoofd(maandLabel(tijd.maand))} is niet de lopende maand; er valt dan weinig vooruit te kijken. ` +
          `Toen hield je ${geld(o.saldo)} over.`);
      }
      const tempo = o.perDag > 0
        ? ` Je geeft nu gemiddeld ${geld(o.perDag)} per dag uit aan losse dingen.` : "";
      return {
        tekst: (o.prognoseSaldo >= 0
          ? `Met dit tempo houd je deze maand ongeveer ${geld(o.prognoseSaldo)} over.`
          : `Met dit tempo kom je deze maand ongeveer ${geld(-o.prognoseSaldo)} tekort.`) +
          ` Er zijn nog ${o.dagenOver} ${o.dagenOver === 1 ? "dag" : "dagen"} te gaan.` + tempo,
        route: "#/start",
      };
    },
  },

  /* "hoeveel kan ik nog per dag uitgeven" */
  {
    naam: "per dag",
    kan: t => /per dag|dagelijks|elke dag/.test(t),
    doe: () => {
      const o = maandOverzicht(state, maandNu());
      if (o.dagenOver <= 0) return zin("Deze maand is al om, dus er valt niets meer over de dagen te verdelen.");
      const ruimte = o.vrijTeBesteden;
      return {
        tekst: ruimte > 0
          ? `Er is nog ${geld(ruimte)} vrij en ${o.dagenOver} ${o.dagenOver === 1 ? "dag" : "dagen"} te gaan — dat is ${geld(ruimte / o.dagenOver)} per dag.`
          : `Er is niets meer vrij deze maand; je zit ${geld(-ruimte)} in de min op wat er nog aankomt.`,
        route: "#/start",
      };
    },
  },

  /* "hoeveel ben ik kwijt aan vaste lasten" */
  {
    naam: "vaste lasten",
    /* Heet je potje óók "Vaste lasten", dan is dit nog steeds de vraag
       die je stelt: wat ben ik maandelijks kwijt. Alleen bij een potje
       van een andere soort laten we het aan die herkenner over. */
    kan: (t, vraag) => /vaste lasten|vaste kosten|vaste uitgaven/.test(t) &&
      /* Vraag je naar de ópbouw van je potje Vaste lasten, dan is dat
         een andere vraag; die laten we aan de herkenner verderop. */
      !(/waaruit|opgebouwd|bestaat|zit er in|onderdelen/.test(t) && heeftSubpotjes(leesPotje(vraag) || {})) &&
      (!leesPotje(vraag) || potSoort(leesPotje(vraag)) === "vast"),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const v = verdeling(state, tijd.maand);
      const los = vasteLastenPerMaand(state);
      const potten = v.potjes.filter(p => p.soort === "vast");
      const totaal = v.vast;
      if (!totaal) return zin("Er staan nog geen vaste lasten in.");
      return {
        tekst: `Je vaste lasten zijn ${geld(totaal)} per maand` +
          (v.inkomen > 0 ? `, oftewel ${procentVan(totaal, v.inkomen)} van je inkomen.` : "."),
        regels: [
          ...potten.map(p => ({ naam: `${p.icoon} ${p.naam}`, bedrag: p.bedrag })),
          ...(los > 0 ? [{ naam: "🔁 Losse vaste posten", bedrag: los }] : []),
        ],
        route: "#/vast",
      };
    },
  },

  /* "wat is mijn vermogen" */
  {
    naam: "vermogen",
    kan: t => /vermogen|netto waarde|in totaal (heb|staat)|hoeveel bezit/.test(t),
    doe: () => {
      const totaal = vermogen(state);
      const rek = rekeningenMetSaldo(state);
      if (!rek.length) return zin("Je hebt nog geen rekeningen ingevoerd, dus je vermogen is niet te berekenen.");
      return {
        tekst: `Alles bij elkaar staat er ${geld(totaal)}.`,
        regels: rek.map(r => ({ naam: r.naam, bedrag: r.saldo })),
        route: "#/rekeningen",
      };
    },
  },

  /* "hoeveel staat er op mijn betaalrekening" */
  {
    naam: "rekeningsaldo",
    kan: t => /saldo|rekening|staat er op/.test(t),
    doe: (t, vraag) => {
      const rek = rekeningenMetSaldo(state);
      if (!rek.length) return zin("Je hebt nog geen rekeningen ingevoerd.");
      const genoemd = rek.find(r => normaliseer(r.naam).length > 2 && normaliseer(vraag).includes(normaliseer(r.naam)));
      if (genoemd) {
        return { tekst: `Op ${genoemd.naam} staat ${geld(genoemd.saldo)}.`, route: "#/rekeningen" };
      }
      return {
        tekst: `Je hebt ${rek.length} ${rek.length === 1 ? "rekening" : "rekeningen"}, samen ${geld(vermogen(state))}.`,
        regels: rek.map(r => ({ naam: r.naam, bedrag: r.saldo })),
        route: "#/rekeningen",
      };
    },
  },

  /* "welke potjes heb ik" */
  {
    naam: "lijst potjes",
    kan: t => /welke potjes|hoeveel potjes|mijn potjes|alle potjes|lijst van potjes/.test(t),
    doe: () => {
      const v = verdeling(state, state.maand);
      if (!v.potjes.length) return zin("Je hebt nog geen potjes. Je maakt ze bij Verdelen.");
      return {
        tekst: `Je hebt ${v.potjes.length} ${v.potjes.length === 1 ? "potje" : "potjes"}, samen ${geld(v.verdeeld)} per maand.`,
        regels: v.potjes.map(p => ({
          naam: `${p.icoon} ${p.naam}`, bedrag: p.bedrag, bij: POTSOORTEN[p.soort]?.label.toLowerCase(),
        })),
        route: "#/potjes",
      };
    },
  },

  /* "hoeveel zit er in vakantie" — het saldo van één potje */
  {
    naam: "opbouw van een potje",
    /* Alleen als er echt onderdelen zijn; anders is de saldovraag
       hieronder een beter antwoord op "wat zit er in". */
    kan: (t, vraag) => !!leesPotje(vraag) && heeftSubpotjes(leesPotje(vraag)) &&
      /waaruit|opgebouwd|bestaat|zit er in|onderdelen/.test(t),
    doe: (t, vraag) => {
      const potje = leesPotje(vraag);
      const delen = subpotjesVan(potje);
      if (!delen.length) {
        const stand = potSaldo(state, potje);
        return { tekst: `${potje.naam} is één bedrag van ${geld(stand.maandbedrag)} per maand; je hebt het niet opgesplitst.`, route: `#/potjes/${potje.id}` };
      }
      return {
        tekst: `${potje.naam} bestaat uit ${delen.length} ${delen.length === 1 ? "onderdeel" : "onderdelen"}.`,
        regels: delen.map(d => ({ naam: d.naam, bedrag: Number(d.bedrag) || 0 })),
        route: `#/potjes/${potje.id}`,
      };
    },
  },
  {
    naam: "saldo van een potje",
    kan: (t, vraag) => !!leesPotje(vraag) && /zit er in|staat er in|saldo|gespaard in|hoeveel heb ik in/.test(t),
    doe: (t, vraag) => {
      const potje = leesPotje(vraag);
      const stand = potSaldo(state, potje, state.maand);
      if (stand.soort === "sparen") {
        const d = potje.doelBedrag > 0 ? ` Je streefbedrag is ${geld(potje.doelBedrag)}.` : "";
        return { tekst: `In ${potje.naam} staat ${geld(stand.saldo)} gespaard.${d}`, route: `#/potjes/${potje.id}` };
      }
      if (stand.soort === "vrij") {
        return { tekst: `${potje.naam} is een potje om op te maken: van ${geld(stand.maandbedrag)} deze maand is nog ${geld(stand.ditOver)} over.`, route: `#/potjes/${potje.id}` };
      }
      return { tekst: `${potje.naam} is een vaste last van ${geld(stand.maandbedrag)} per maand; daar bouwt zich geen saldo op.`, route: `#/potjes/${potje.id}` };
    },
  },

  /* "welke maand was het duurst" */
  {
    naam: "duurste maand",
    kan: t => /welke maand|duurste maand|goedkoopste maand|beste maand|slechtste maand/.test(t),
    doe: t => {
      const reeks = maandReeks(state, 12).filter(m => m.uit > 0 || m.in > 0);
      if (reeks.length < 2) return zin("Er zijn nog te weinig maanden om te vergelijken.");
      const goedkoop = /goedkoop|minste|beste/.test(t);
      const op = [...reeks].sort((a, b) => goedkoop ? a.uit - b.uit : b.uit - a.uit)[0];
      return {
        tekst: `${hoofd(maandLabel(op.maand))} was de ${goedkoop ? "goedkoopste" : "duurste"} maand: ${geld(op.uit)} eruit.`,
        regels: [...reeks].sort((a, b) => b.uit - a.uit).slice(0, 6)
          .map(m => ({ naam: maandLabel(m.maand, { kort: true }), bedrag: m.uit })),
        route: "#/cijfers",
      };
    },
  },

  /* "wat geef ik gemiddeld uit" */
  {
    naam: "gemiddeld",
    kan: t => /gemiddeld|normaal gesproken|doorgaans/.test(t),
    doe: (t, vraag) => {
      const potje = leesPotje(vraag);
      if (potje) {
        const rijen = potGeschiedenis(state, potje, { maanden: 12 });
        if (!rijen.length) return zin(`Er staat nog niets geboekt bij ${potje.naam}.`);
        const totaal = rijen.reduce((sm, r) => sm + r.totaal, 0);
        return {
          tekst: `Gemiddeld gaat er ${geld(totaal / rijen.length)} per maand uit ${potje.naam}, gemeten over ${rijen.length} ${rijen.length === 1 ? "maand" : "maanden"}.`,
          regels: rijen.map(r => ({ naam: maandLabel(r.maand, { kort: true }), bedrag: r.totaal })),
          route: `#/potjes/${potje.id}`,
        };
      }
      const g = gemiddelden(state, 6);
      if (!g.maanden) return zin("Er zijn nog te weinig maanden om een gemiddelde uit te rekenen.");
      return {
        tekst: `Over de laatste ${g.maanden} ${g.maanden === 1 ? "maand" : "maanden"} kwam er gemiddeld ${geld(g.in)} binnen en ging er ${geld(g.uit)} uit — ${geld(g.saldo)} over per maand.`,
        route: "#/cijfers",
      };
    },
  },

  /* "welk deel spaar ik" */
  {
    naam: "spaarquote",
    kan: t => /procent|percentage|quote|welk deel|hoeveel deel/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const v = verdeling(state, tijd.maand);
      if (!v.inkomen) return zin("Zonder inkomen valt er geen percentage uit te rekenen.");
      return {
        tekst: `Van ${geld(v.inkomen)} gaat ${procentVan(v.sparen, v.inkomen)} naar sparen, ` +
          `${procentVan(v.vast, v.inkomen)} naar vaste lasten en ${procentVan(v.vrij, v.inkomen)} naar vrij besteden.`,
        regels: [
          { naam: "🐖 Sparen", bedrag: v.sparen },
          { naam: "🏠 Vaste lasten", bedrag: v.vast },
          { naam: "🛒 Vrij te besteden", bedrag: v.vrij },
          ...(v.over > 0.5 ? [{ naam: "Nog te verdelen", bedrag: v.over }] : []),
        ],
        route: "#/start",
      };
    },
  },

  /* "wat heb ik nog niet ingedeeld" */
  {
    naam: "niet ingedeeld",
    kan: t => /niet ingedeeld|nergens bij|zonder potje|ongesorteerd|niet gesorteerd|rest van de boekingen/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const a = potAnalyse(state, tijd.maand);
      if (!a.nergens.aantal) return zin(`In ${maandLabel(tijd.maand)} hangt elke uitgave aan een potje.`);
      return {
        tekst: `In ${maandLabel(tijd.maand)} ${a.nergens.aantal === 1 ? "hangt" : "hangen"} ${a.nergens.aantal} ${a.nergens.aantal === 1 ? "boeking" : "boekingen"} aan geen enkel potje, samen ${geld(a.nergens.totaal)}.`,
        regels: a.nergens.transacties.slice(0, 8).map(x => ({ naam: x.omschrijving || "Zonder omschrijving", bedrag: Number(x.bedrag) || 0 })),
        route: "#/maand",
      };
    },
  },

  /* "wat komt er binnenkort af" */
  {
    naam: "wat komt eraan",
    kan: t => /komt eraan|binnenkort|aankomend|deze week|staat te gebeuren|moet ik nog betalen/.test(t),
    doe: () => {
      const lijst = aankomend(state, 21);
      if (!lijst.length) return zin("Er staan de komende weken geen vaste posten gepland.");
      const totaal = lijst.filter(p => p.soort !== "inkomst").reduce((sm, p) => sm + p.verwacht, 0);
      return {
        tekst: `De komende drie weken staat er ${geld(totaal)} aan vaste posten gepland.`,
        regels: lijst.slice(0, 8).map(p => ({
          naam: p.naam, bedrag: p.verwacht,
          bij: p.telaat ? "te laat" : `over ${p.overDagen} ${p.overDagen === 1 ? "dag" : "dagen"}`,
        })),
        route: "#/vast",
      };
    },
  },

  /* "hoe sta ik ervoor" */
  {
    naam: "hoe sta ik ervoor",
    kan: t => /hoe sta ik|hoe gaat het|hoe staat het ervoor|alles goed|samenvatting|overzicht/.test(t),
    doe: () => {
      const v = verdeling(state, state.maand);
      const a = potAnalyse(state, state.maand);
      const sig = signalen(state, state.maand);
      const kop = sig.length
        ? sig[0].titel + ". " + sig[0].tekst
        : `Je verdeelt ${geld(v.verdeeld)} van ${geld(v.inkomen)}, en je zit overal binnen je budget.`;
      return {
        tekst: kop,
        regels: [
          { naam: "Inkomen deze maand", bedrag: v.inkomen },
          { naam: "Verdeeld", bedrag: v.verdeeld },
          { naam: "Uitgegeven", bedrag: a.besteed + a.nergens.totaal },
          { naam: "Gespaard in totaal", bedrag: v.gespaard },
        ],
        route: "#/start",
      };
    },
  },

  /* "bij welke winkel geef ik het meeste uit" */
  {
    naam: "per winkel",
    kan: t => /welke winkel|per winkel|welke winkels|waar koop ik/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const koppeling = state.instellingen.koppeling || {};
      const potje = state.potjes.find(p => p.id === koppeling.potje);
      if (koppeling.aan && potje) {
        const d = potMaandDetail(state, potje, tijd.maand);
        if (d.winkels.length) {
          return {
            tekst: `In ${maandLabel(tijd.maand)} ging er het meeste naar ${d.winkels[0].naam} (${geld(d.winkels[0].bedrag)}).`,
            regels: d.winkels.map(w => ({ naam: w.naam, bedrag: w.bedrag, bij: `${w.aantal} ${w.aantal === 1 ? "bon" : "bonnen"}` })),
            route: `#/potjes/${potje.id}`,
          };
        }
      }
      /* Zonder koppeling: op omschrijving groeperen. */
      const per = new Map();
      for (const x of state.transacties) {
        if (x.soort !== "uitgave" || maandVan(x.datum) !== tijd.maand) continue;
        const sleutel = (x.omschrijving || "Zonder omschrijving").split(/[—\-,]/)[0].trim().slice(0, 30);
        per.set(sleutel, (per.get(sleutel) || 0) + (Number(x.bedrag) || 0));
      }
      const lijst = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (!lijst.length) return zin(`Er staan geen uitgaven in ${maandLabel(tijd.maand)}.`);
      return {
        tekst: `In ${maandLabel(tijd.maand)} ging er het meeste naar ${lijst[0][0]} (${geld(lijst[0][1])}).`,
        regels: lijst.map(([naam, bedrag]) => ({ naam, bedrag })),
        route: "#/maand",
      };
    },
  },

  /* "hoeveel boekingen heb ik" */
  {
    naam: "aantal boekingen",
    kan: t => /hoeveel boekingen|hoeveel transacties|hoe vaak heb ik|aantal boekingen/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const lijst = state.transacties.filter(x => tijd.jaar
        ? x.datum.startsWith(tijd.jaar) : maandVan(x.datum) === tijd.maand);
      const uitgaven = lijst.filter(x => x.soort === "uitgave");
      return zin(`In ${tijd.jaar || maandLabel(tijd.maand)} staan ${lijst.length} ${lijst.length === 1 ? "boeking" : "boekingen"}, waarvan ${uitgaven.length} ${uitgaven.length === 1 ? "uitgave" : "uitgaven"}.`);
    },
  },

  /* "hoeveel aan vervoer" — per categorie, voor wie categorieën gebruikt */
  {
    naam: "per categorie",
    kan: (t, vraag) => !leesPotje(vraag) && !!leesCategorie(vraag) &&
      /hoeveel|wat|uitgegeven|besteed|kwijt/.test(t),
    doe: (t, vraag) => {
      const cat = leesCategorie(vraag);
      const tijd = leesMaand(vraag);
      const lijst = perCategorie(state, tijd.maand).find(c => c.id === cat.id);
      if (!lijst) return zin(`In ${maandLabel(tijd.maand)} staat er niets onder ${cat.naam}.`);
      return {
        tekst: `In ${maandLabel(tijd.maand)} ging er ${geld(lijst.bedrag)} naar ${cat.naam}.` +
          (cat.budget > 0 ? ` Je budget is ${geld(cat.budget)}.` : ""),
        route: "#/cijfers",
      };
    },
  },

  /* "is dat meer dan vorige maand" — vergelijken met de maand ervoor */
  {
    naam: "vergelijken met vorige maand",
    kan: t => /meer dan|minder dan|vergelek|vergelijk|verhoud|tegenover|dan vorige|dan vorig/.test(t),
    doe: (t, vraag) => {
      const potje = leesPotje(vraag);
      const nu = state.maand;
      const eerder = maandPlus(nu, -1);

      const som = m => potje
        ? potSaldo(state, potje, m).ditUit
        : (() => { const a = potAnalyse(state, m); return a.besteed + a.nergens.totaal; })();

      const a = som(nu), b = som(eerder);
      const waarover = potje ? potje.naam : "Bij elkaar";
      if (b === 0 && a === 0) return zin(`In ${maandLabel(nu)} en ${maandLabel(eerder)} staat er niets geboekt om te vergelijken.`);

      const verschil = a - b;
      return {
        tekst: `${waarover}: ${geld(a)} in ${maandLabel(nu)}, tegen ${geld(b)} in ${maandLabel(eerder)}. ` +
          (Math.abs(verschil) < 0.5 ? "Vrijwel gelijk."
            : verschil > 0 ? `Dat is ${geld(verschil)} méér.` : `Dat is ${geld(-verschil)} minder.`),
        regels: [
          { naam: maandLabel(nu, { kort: true }), bedrag: a },
          { naam: maandLabel(eerder, { kort: true }), bedrag: b },
        ],
        route: potje ? `#/potjes/${potje.id}` : "#/cijfers",
      };
    },
  },

  {
    naam: "budget",
    kan: t => /budget|te veel|teveel|overschre|binnen de lijnen|klopt het/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const a = potAnalyse(state, tijd.maand);
      if (!a.overschreden.length) {
        return {
          tekst: a.besteed > 0
            ? `In ${maandLabel(tijd.maand)} zit je overal binnen je budget. Samen ${geld(a.besteed)} van ${geld(a.budget)}.`
            : `In ${maandLabel(tijd.maand)} staat er nog niets geboekt om tegen je budget af te zetten.`,
          route: "#/cijfers",
        };
      }
      return {
        tekst: `In ${maandLabel(tijd.maand)} ga je bij ${a.overschreden.length} ${a.overschreden.length === 1 ? "potje" : "potjes"} over je budget heen.`,
        regels: a.overschreden.map(p => ({
          naam: `${p.icoon} ${p.naam}`, bedrag: p.besteed - p.budget, bij: `van ${geld(p.budget)}`,
        })),
        route: "#/cijfers",
      };
    },
  },
  {
    naam: "grootste uitgaven",
    kan: t => /grootste|duurste|hoogste|meeste uitgegeven|in (een|1) keer/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const lijst = state.transacties
        .filter(x => x.soort === "uitgave" && (tijd.jaar
          ? x.datum.startsWith(tijd.jaar) : maandVan(x.datum) === tijd.maand))
        .sort((a, b) => (Number(b.bedrag) || 0) - (Number(a.bedrag) || 0))
        .slice(0, 8);
      if (!lijst.length) return zin(`Er staan geen uitgaven in ${tijd.jaar || maandLabel(tijd.maand)}.`);
      return {
        tekst: `De grootste uitgave ${tijd.jaar ? `in ${tijd.jaar}` : `in ${maandLabel(tijd.maand)}`} was ${geld(lijst[0].bedrag)} bij ${lijst[0].omschrijving || "een onbekende partij"}.`,
        regels: lijst.map(x => ({ naam: x.omschrijving || "Zonder omschrijving", bedrag: Number(x.bedrag) || 0 })),
        route: "#/maand",
      };
    },
  },

  /* "hoeveel gaf ik uit aan boodschappen in september" */
  {
    naam: "uitgave per potje",
    kan: (t, vraag) => /hoeveel|wat/.test(t) && (
      /uitgegeven|uitgeven|gaf|besteed|kwijt|opgegaan|ging er|gaat er ?uit|op ?gegaan/.test(t) ||
      /* "Hoeveel aan boodschappen deze maand?" — zonder werkwoord, maar
         met een potje erin is het duidelijk genoeg. Een naam alléén is
         dat níét: "wat vind jij van bitcoin" gaat niet over je geld, en
         zo'n vraag hoort eerlijk onbeantwoord te blijven. */
      (!!leesPotje(vraag) && !/over|ruimte|resteert|restant|spaar|verdien|budget/.test(t))),
    doe: (t, vraag) => {
      const potje = leesPotje(vraag);
      const tijd = leesMaand(vraag);

      if (potje) {
        if (tijd.jaar) {
          const rijen = potGeschiedenis(state, potje, { maanden: 24 })
            .filter(r => r.maand.startsWith(tijd.jaar));
          const totaal = rijen.reduce((s, r) => s + r.totaal, 0);
          if (!rijen.length) return zin(`In ${tijd.jaar} staat er niets geboekt bij ${potje.naam}.`);
          return {
            tekst: `In ${tijd.jaar} ging er ${geld(totaal)} uit ${potje.naam}, over ${rijen.length} ${rijen.length === 1 ? "maand" : "maanden"} — gemiddeld ${geld(totaal / rijen.length)} per maand.`,
            regels: rijen.map(r => ({ naam: maandLabel(r.maand, { kort: true }), bedrag: r.totaal })),
            route: `#/potjes/${potje.id}`,
          };
        }
        const stand = potSaldo(state, potje, tijd.maand);
        const budget = stand.maandbedrag;
        const verschil = budget - stand.ditUit;
        return {
          tekst: `In ${maandLabel(tijd.maand)} ging er ${geld(stand.ditUit)} uit ${potje.naam}.` +
            (budget > 0
              ? verschil >= 0
                ? ` Dat is ${geld(verschil)} minder dan de ${geld(budget)} die je ervoor had gezet.`
                : ` Dat is ${geld(-verschil)} méér dan de ${geld(budget)} die je ervoor had gezet.`
              : ""),
          route: `#/potjes/${potje.id}`,
        };
      }

      /* Geen potje, maar wel een winkel genoemd? Dan zoeken we daarop
         in de omschrijvingen. Beter dan het maandtotaal teruggeven op
         een vraag die daar niet over ging. */
      const wie = leesTegenpartij(vraag);
      if (wie) {
        const raak = state.transacties.filter(x =>
          x.soort === "uitgave" && normaliseer(x.omschrijving).includes(wie) &&
          (tijd.jaar ? x.datum.startsWith(tijd.jaar) : maandVan(x.datum) === tijd.maand));
        const wanneer = tijd.jaar || maandLabel(tijd.maand);
        if (!raak.length) {
          return zin(`Ik vind in ${wanneer} geen uitgaven bij iets dat op "${wie}" lijkt.`);
        }
        const totaal = raak.reduce((sm, x) => sm + (Number(x.bedrag) || 0), 0);
        return {
          tekst: `In ${wanneer} ging er ${geld(totaal)} naar ${raak[0].omschrijving || wie}, verdeeld over ${raak.length} ${raak.length === 1 ? "boeking" : "boekingen"}.`,
          regels: raak.slice(0, 8).map(x => ({ naam: x.omschrijving || wie, bij: x.datum.slice(8) + "-" + x.datum.slice(5, 7), bedrag: Number(x.bedrag) || 0 })),
          route: "#/maand",
        };
      }

      /* Een heel jaar overzien: alle maanden bij elkaar. */
      if (tijd.jaar) {
        const rijen = maandenVan(tijd.jaar).map(m => {
          const x = potAnalyse(state, m);
          return { maand: m, totaal: x.besteed + x.nergens.totaal };
        }).filter(r => r.totaal > 0);
        if (!rijen.length) return zin(`In ${tijd.jaar} staat er nog niets geboekt.`);
        const totaal = rijen.reduce((sm, r) => sm + r.totaal, 0);
        return {
          tekst: `In ${tijd.jaar} ging er ${geld(totaal)} uit, over ${rijen.length} ${rijen.length === 1 ? "maand" : "maanden"} — gemiddeld ${geld(totaal / rijen.length)} per maand.`,
          regels: rijen.map(r => ({ naam: maandLabel(r.maand, { kort: true }), bedrag: r.totaal })),
          route: "#/cijfers",
        };
      }

      /* Geen potje genoemd: dan het hele plaatje van die maand. */
      const a = potAnalyse(state, tijd.maand);
      const metIets = a.potjes.filter(p => p.besteed > 0);
      if (!metIets.length && !a.nergens.aantal) {
        return zin(`In ${maandLabel(tijd.maand)} staat er nog niets geboekt.`);
      }
      return {
        tekst: `In ${maandLabel(tijd.maand)} ging er ${geld(a.besteed + a.nergens.totaal)} uit.`,
        regels: [
          ...metIets.map(p => ({ naam: `${p.icoon} ${p.naam}`, bedrag: p.besteed })),
          ...(a.nergens.aantal ? [{ naam: "❓ Nergens bij", bedrag: a.nergens.totaal }] : []),
        ],
        route: "#/cijfers",
      };
    },
  },

  /* "wat is er nog over" */
  {
    naam: "nog over",
    kan: t => /over|resteert|restant|ruimte/.test(t) && !/verdelen|budget|overschre/.test(t),
    doe: (t, vraag) => {
      const potje = leesPotje(vraag);
      const tijd = leesMaand(vraag);

      if (potje) {
        const stand = potSaldo(state, potje, tijd.maand);
        if (stand.soort === "sparen") {
          return { tekst: `In ${potje.naam} staat ${geld(stand.saldo)} gespaard.`, route: `#/potjes/${potje.id}` };
        }
        if (stand.soort === "vast") {
          return { tekst: `${potje.naam} is een vaste last van ${geld(stand.maandbedrag)} per maand — daar blijft niets van over, dat gaat er gewoon af.`, route: `#/potjes/${potje.id}` };
        }
        return {
          tekst: `Van ${potje.naam} is deze maand nog ${geld(stand.ditOver)} over, van ${geld(stand.maandbedrag)}.`,
          route: `#/potjes/${potje.id}`,
        };
      }

      const v = verdeling(state, tijd.maand);
      const a = potAnalyse(state, tijd.maand);
      const vrij = a.potjes.filter(p => p.soort === "vrij" && p.budget > 0);
      return {
        tekst: v.over > 0.5
          ? `Van ${geld(v.inkomen)} inkomen heb je ${geld(v.over)} nog niet verdeeld.`
          : v.over < -0.5
            ? `Je hebt ${geld(-v.over)} méér verdeeld dan er binnenkomt.`
            : `Je inkomen van ${geld(v.inkomen)} is helemaal verdeeld.`,
        regels: vrij.map(p => ({ naam: `${p.icoon} ${p.naam}`, bedrag: p.budget - p.besteed, bij: "nog over" })),
        route: "#/verdelen",
      };
    },
  },

  /* "waar gaat mijn geld heen" */
  {
    naam: "waar gaat het heen",
    kan: t => /waar.*(heen|naartoe|blijft|gaat)|verdeling/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const v = verdeling(state, tijd.maand);
      const posten = v.posten.filter(p => p.bedrag > 0).slice(0, 8);
      if (!posten.length) return zin("Er is nog niets verdeeld, dus daar valt weinig over te zeggen.");
      return {
        tekst: `Van ${geld(v.inkomen)} in ${maandLabel(tijd.maand)} gaat het grootste deel naar ${posten[0].naam} (${geld(posten[0].bedrag)}).`,
        regels: posten.map(p => ({ naam: `${p.icoon || "•"} ${p.naam}`, bedrag: p.bedrag })),
        route: "#/start",
      };
    },
  },

  /* "hoeveel spaar ik per maand" */
  {
    naam: "sparen",
    kan: t => /spaar|sparen|gespaard|opzij/.test(t) && !/doel|streef/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const v = verdeling(state, tijd.maand);
      const spaarpotjes = v.potjes.filter(p => p.soort === "sparen");
      const totaalSaldo = spaarpotjes.reduce((s, p) => s + p.stand.saldo, 0);
      if (!spaarpotjes.length) return zin("Je hebt nog geen spaarpotjes. Je maakt er een onder Potjes.");
      return {
        tekst: `Je zet ${geld(v.sparen)} per maand opzij. Bij elkaar staat er nu ${geld(totaalSaldo)}.`,
        regels: spaarpotjes.map(p => ({ naam: `${p.icoon} ${p.naam}`, bedrag: p.stand.saldo, bij: `${geld(p.bedrag)}/mnd` })),
        route: "#/potjes",
      };
    },
  },

  /* "hoeveel verdien ik" */
  {
    naam: "inkomen",
    kan: t => /verdien|inkomen|salaris|binnen ?kom|binnenkomt|komt er binnen|krijg ik/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      if (tijd.jaar) {
        const maanden = maandenVan(tijd.jaar);
        const totaal = maanden.reduce((s, m) => {
          const o = maandOverzicht(state, m);
          return s + o.inkomsten + o.verwachtErin;
        }, 0);
        return { tekst: `In ${tijd.jaar} kwam er tot nu toe ${geld(totaal)} binnen, over ${maanden.length} ${maanden.length === 1 ? "maand" : "maanden"}.`, route: "#/inkomen" };
      }
      const o = maandOverzicht(state, tijd.maand);
      const inkomen = o.inkomsten + o.verwachtErin;
      const bronnen = state.terugkerend.filter(p => p.soort === "inkomst" && p.actief !== false);
      return {
        tekst: inkomen > 0
          ? `In ${maandLabel(tijd.maand)} komt er ${geld(inkomen)} binnen.`
          : `Voor ${maandLabel(tijd.maand)} staat er nog geen inkomen.`,
        regels: bronnen.map(p => ({ naam: p.naam, bedrag: Number(p.bedrag) || 0 })),
        route: "#/inkomen",
      };
    },
  },

  /* "ga ik over mijn budget" */

  /* "haal ik mijn spaardoel" */
  {
    naam: "doelen",
    kan: t => /doel|vakantie geld|streef|haal ik/.test(t),
    doe: () => {
      const doelen = doelenMetStand(state).filter(d => !d.klaar);
      if (!doelen.length) return zin("Er lopen geen spaardoelen. Je maakt er een onder Potjes → Spaardoelen.");
      const d = doelen[0];
      return {
        tekst: `${d.naam}: ${geld(d.huidig)} van ${geld(d.doelBedrag)}.` +
          (d.perMaandNodig ? ` Om het op tijd te halen moet er ${geld(d.perMaandNodig)} per maand bij.` : ""),
        regels: doelen.map(x => ({ naam: `${x.icoon} ${x.naam}`, bedrag: x.huidig, bij: `van ${geld(x.doelBedrag)}` })),
        route: "#/doelen",
      };
    },
  },

  /* "waar heb ik het meest besteed" — grootste losse uitgaven */

  /* "wat zit er in mijn potje vaste lasten" */

  /* "hoeveel boodschappen deze maand" via de gekoppelde app */
  {
    naam: "boodschappen uit de andere app",
    kan: t => /boodschap/.test(t),
    doe: (t, vraag) => {
      const tijd = leesMaand(vraag);
      const extern = externeUitgaven(state, tijd.maand);
      if (!extern.aan) return null;        // koppeling uit: laat een ander het proberen
      return {
        tekst: `In ${maandLabel(tijd.maand)} is er ${geld(extern.totaal)} aan boodschappen afgerekend, in ${extern.aantal} ${extern.aantal === 1 ? "bon" : "bonnen"}.`,
        route: "#/start",
      };
    },
  },
];

const zin = tekst => ({ tekst });
const hoofd = t => t.charAt(0).toUpperCase() + t.slice(1);
const procentVan = (deel, geheel) => geheel > 0 ? `${Math.round((deel / geheel) * 100)}%` : "0%";

/* Welke categorie bedoelt iemand? Alleen als de naam er letterlijk in
   staat — categorieën zijn in de eenvoudige modus verborgen, dus we
   gaan er niet naar raden. */
export function leesCategorie(vraag) {
  const t = normaliseer(vraag);
  return state.categorieen
    .filter(c => normaliseer(c.naam).length > 3 && t.includes(normaliseer(c.naam)))
    .sort((a, b) => b.naam.length - a.naam.length)[0] || null;
}

/* ---------------------------------------------------------------
   Antwoorden
   --------------------------------------------------------------- */
export function beantwoord(vraag) {
  const t = normaliseer(vraag);
  if (!t.trim()) return null;

  for (const h of HERKENNERS) {
    try {
      if (!h.kan(t, vraag)) continue;
      const uit = h.doe(t, vraag);
      if (uit) return { ...uit, herkenner: h.naam, bron: "lokaal" };
    } catch {
      /* Eén kapotte herkenner mag de rest niet meenemen. */
    }
  }
  return null;
}

/* Wat de vraagbalk voorstelt als je nog niets hebt getikt. Alleen
   vragen waar in jouw gegevens ook echt een antwoord op is. */
export function voorbeelden() {
  const uit = ["Hoe sta ik ervoor?", "Waar gaat mijn geld heen?"];
  const vrij = state.potjes.find(p => p.soort === "vrij" && p.actief !== false);
  if (vrij) uit.push(`Hoeveel gaf ik uit aan ${vrij.naam.toLowerCase()}?`);
  if (state.transacties.some(t => t.soort === "uitgave")) {
    uit.push("Red ik het tot het eind van de maand?", "Is dat meer dan vorige maand?");
  }
  if (state.potjes.some(p => p.soort === "sparen")) uit.push("Hoeveel spaar ik per maand?");
  if (state.terugkerend.some(p => p.soort === "inkomst")) uit.push("Hoeveel verdien ik?");
  uit.push("Ga ik over mijn budget?", "Wat kan ik vragen?");
  return uit.slice(0, 6);
}

/* ---------------------------------------------------------------
   Wat een model zou moeten weten
   ---------------------------------------------------------------
   Als je de AI aanzet gaat dít eroverheen, en niets anders: een
   samenvatting in cijfers. Geen losse boekingen, geen tegenpartijen,
   geen rekeningnummers. Genoeg om over je huishoudboekje te praten,
   te weinig om te zien waar je geweest bent.
   --------------------------------------------------------------- */
export function samenvatting(maand = state.maand) {
  const v = verdeling(state, maand);
  const a = potAnalyse(state, maand);
  const o = maandOverzicht(state, maand);

  return {
    maand,
    vandaag: maandNu(),
    inkomen: afgerond(v.inkomen),
    verdeeld: afgerond(v.verdeeld),
    nogTeVerdelen: afgerond(v.over),
    perSoort: { vast: afgerond(v.vast), vrij: afgerond(v.vrij), sparen: afgerond(v.sparen) },
    gespaardTotaal: afgerond(v.gespaard),
    potjes: a.potjes.map(p => ({
      naam: p.naam,
      soort: p.soort,
      perMaand: afgerond(p.budget),
      ditUitgegeven: afgerond(p.besteed),
      saldo: p.soort === "sparen" ? afgerond(potSaldo(state, p.potje, maand).saldo) : null,
      onderdelen: subpotjesVan(p.potje).map(d => ({ naam: d.naam, bedrag: afgerond(d.bedrag) })),
    })),
    nietIngedeeld: { aantal: a.nergens.aantal, totaal: afgerond(a.nergens.totaal) },
    doelen: doelenMetStand(state).map(d => ({
      naam: d.naam, nu: afgerond(d.huidig), streef: afgerond(d.doelBedrag),
      perMaandNodig: afgerond(d.perMaandNodig), gehaald: !!d.klaar,
    })),
    vasteLastenPerMaand: afgerond(o.vastTotaal + o.verwachtEruit),
  };
}

const afgerond = n => (isFinite(Number(n)) ? Math.round(Number(n) * 100) / 100 : null);
