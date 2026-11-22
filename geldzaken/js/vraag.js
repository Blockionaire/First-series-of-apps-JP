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
         doelenMetStand, externeUitgaven, subpotjesVan } from "./bereken.js";

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

  /* "is dat meer dan vorige maand" — vergelijken met de maand ervoor */
  {
    naam: "vergelijken met vorige maand",
    kan: t => /meer dan|minder dan|vergelek|vergelijk|tegenover|dan vorige|dan vorig/.test(t),
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
    kan: t => /grootste|duurste|meeste uitgegeven|hoogste/.test(t),
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
      (!!leesPotje(vraag) && !/over|spaar|verdien|budget/.test(t))),
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
  {
    naam: "opbouw van een potje",
    kan: (t, vraag) => !!leesPotje(vraag) && /waaruit|opgebouwd|bestaat|zit er in|onderdelen/.test(t),
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
  const uit = ["Waar gaat mijn geld heen?", "Wat is er nog over?"];
  const vrij = state.potjes.find(p => p.soort === "vrij" && p.actief !== false);
  if (vrij) uit.push(`Hoeveel gaf ik uit aan ${vrij.naam.toLowerCase()}?`);
  if (state.potjes.some(p => p.soort === "sparen")) uit.push("Hoeveel spaar ik per maand?");
  if (state.terugkerend.some(p => p.soort === "inkomst")) uit.push("Hoeveel verdien ik?");
  if (state.transacties.some(t => t.soort === "uitgave")) uit.push("Wat was mijn grootste uitgave?");
  uit.push("Ga ik over mijn budget?");
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
