/* =====================================================================
   GELDZAKEN — testvragen voor de vraagbalk
   =====================================================================
   Elke regel is één manier waarop iemand iets kan vragen, met de
   herkenner die hem hoort op te pakken. Open test/vragen.html en je
   ziet meteen of het nog klopt.

   Zelf een vraag toevoegen? Zet er een regel bij:

       { vraag: "Wat kost mijn auto per maand?", hoort: "uitgave per potje" },

   De naam achter `hoort` is de `naam:` van een herkenner in
   js/vraag.js. Weet je die niet, tik de vraag dan onderaan die pagina
   in — daar staat welke herkenner aanslaat, en krijg je de regel
   kant-en-klaar om te plakken.

   `hoort: null` betekent: hier hoort géén antwoord op te komen. Die
   regels zijn net zo belangrijk als de rest. Een vraag die niet over
   je geld gaat moet eerlijk onbeantwoord blijven, want een verkeerd
   antwoord is erger dan geen antwoord — en alleen zo komt hij door
   naar Claude, als je die hebt aanstaan.
   ===================================================================== */

export const TESTVRAGEN = [

  /* ---------------------------- Uitgeven --------------------------- */
  { vraag: "Hoeveel gaf ik uit aan boodschappen?",            hoort: "uitgave per potje" },
  { vraag: "Hoeveel ben ik kwijt aan uitgaan?",               hoort: "uitgave per potje" },
  { vraag: "Hoeveel ging er vorige maand uit boodschappen?",  hoort: "uitgave per potje" },
  { vraag: "Hoeveel heb ik besteed in september?",            hoort: "uitgave per potje" },
  { vraag: "Hoeveel aan boodschappen deze maand?",            hoort: "uitgave per potje" },
  { vraag: "Hoeveel heb ik in 2026 uitgegeven?",              hoort: "uitgave per potje" },
  { vraag: "Hoeveel gaf ik uit bij Albert Heijn?",            hoort: "uitgave per potje" },

  { vraag: "Wat was mijn grootste uitgave?",                  hoort: "grootste uitgaven" },
  { vraag: "Wat is mijn duurste uitgave in oktober?",         hoort: "grootste uitgaven" },
  { vraag: "Waar ging het meeste geld heen in één keer?",     hoort: "grootste uitgaven" },

  { vraag: "Bij welke winkel geef ik het meeste uit?",        hoort: "per winkel" },
  { vraag: "Waar koop ik het meest?",                         hoort: "per winkel" },

  { vraag: "Wat geef ik gemiddeld uit?",                      hoort: "gemiddeld" },
  { vraag: "Hoeveel gaat er gemiddeld uit boodschappen?",     hoort: "gemiddeld" },

  { vraag: "Is dat meer dan vorige maand?",                   hoort: "vergelijken met vorige maand" },
  { vraag: "Geef ik meer uit dan vorige maand?",              hoort: "vergelijken met vorige maand" },
  { vraag: "Hoe verhoudt dit zich tot vorige maand?",         hoort: "vergelijken met vorige maand" },

  { vraag: "Welke maand was het duurst?",                     hoort: "duurste maand" },
  { vraag: "Wat was mijn goedkoopste maand?",                 hoort: "duurste maand" },

  { vraag: "Hoeveel boekingen heb ik deze maand?",            hoort: "aantal boekingen" },
  { vraag: "Hoeveel transacties staan er in 2026?",           hoort: "aantal boekingen" },

  /* --------------------------- Vooruitkijken ----------------------- */
  { vraag: "Red ik het tot het eind van de maand?",           hoort: "vooruitblik" },
  { vraag: "Houd ik deze maand iets over?",                   hoort: "vooruitblik" },
  { vraag: "Kom ik uit deze maand?",                          hoort: "vooruitblik" },
  { vraag: "Kom ik tekort?",                                  hoort: "vooruitblik" },

  { vraag: "Hoeveel kan ik nog per dag uitgeven?",            hoort: "per dag" },
  { vraag: "Wat kan ik dagelijks nog besteden?",              hoort: "per dag" },

  { vraag: "Wat komt er binnenkort af?",                      hoort: "wat komt eraan" },
  { vraag: "Wat moet ik nog betalen?",                        hoort: "wat komt eraan" },

  /* ----------------------------- Overzicht ------------------------- */
  { vraag: "Hoe sta ik ervoor?",                              hoort: "hoe sta ik ervoor" },
  { vraag: "Hoe gaat het met mijn geld?",                     hoort: "hoe sta ik ervoor" },
  { vraag: "Geef eens een samenvatting",                      hoort: "hoe sta ik ervoor" },

  { vraag: "Wat is er nog over?",                             hoort: "nog over" },
  { vraag: "Hoeveel ruimte heb ik nog bij boodschappen?",     hoort: "nog over" },
  { vraag: "Wat resteert er?",                                hoort: "nog over" },

  { vraag: "Waar gaat mijn geld heen?",                       hoort: "waar gaat het heen" },
  { vraag: "Wat is de verdeling?",                            hoort: "waar gaat het heen" },
  { vraag: "Waar blijft mijn geld?",                          hoort: "waar gaat het heen" },

  { vraag: "Ga ik over mijn budget?",                         hoort: "budget" },
  { vraag: "Zit ik nog binnen de lijnen?",                    hoort: "budget" },
  { vraag: "Geef ik te veel uit?",                            hoort: "budget" },
  { vraag: "Klopt het nog met mijn budget?",                  hoort: "budget" },

  { vraag: "Welk deel spaar ik?",                             hoort: "spaarquote" },

  { vraag: "Wat heb ik nog niet ingedeeld?",                  hoort: "niet ingedeeld" },
  { vraag: "Welke boekingen horen nergens bij?",              hoort: "niet ingedeeld" },

  /* ------------------------------ Potjes --------------------------- */
  { vraag: "Welke potjes heb ik?",                            hoort: "lijst potjes" },
  { vraag: "Hoeveel potjes heb ik?",                          hoort: "lijst potjes" },
  { vraag: "Laat al mijn potjes zien",                        hoort: "lijst potjes" },

  { vraag: "Hoeveel zit er in vakantie?",                     hoort: "saldo van een potje" },
  { vraag: "Hoeveel staat er in vakantie?",                   hoort: "saldo van een potje" },

  { vraag: "Waaruit bestaat vaste lasten?",                   hoort: "opbouw van een potje" },
  { vraag: "Wat zit er in vaste lasten?",                     hoort: "opbouw van een potje" },

  /* ------------------------ Sparen en inkomen ---------------------- */
  { vraag: "Hoeveel spaar ik per maand?",                     hoort: "sparen" },
  { vraag: "Hoeveel staat er gespaard?",                      hoort: "sparen" },
  { vraag: "Hoeveel zet ik opzij?",                           hoort: "sparen" },

  { vraag: "Haal ik mijn spaardoel?",                         hoort: "doelen" },
  { vraag: "Hoe staat het met mijn doelen?",                  hoort: "doelen" },
  { vraag: "Wat is mijn streefbedrag?",                       hoort: "doelen" },

  { vraag: "Hoeveel verdien ik?",                             hoort: "inkomen" },
  { vraag: "Wat is mijn inkomen deze maand?",                 hoort: "inkomen" },
  { vraag: "Wat komt er binnen?",                             hoort: "inkomen" },
  { vraag: "Wat krijg ik deze maand?",                        hoort: "inkomen" },

  /* -------------------- Vaste lasten, vermogen --------------------- */
  { vraag: "Hoeveel ben ik kwijt aan vaste lasten?",          hoort: "vaste lasten" },
  { vraag: "Wat zijn mijn vaste kosten?",                     hoort: "vaste lasten" },
  { vraag: "Hoeveel procent gaat naar vaste lasten?",         hoort: "vaste lasten" },

  { vraag: "Wat is mijn vermogen?",                           hoort: "vermogen" },
  { vraag: "Hoeveel bezit ik?",                               hoort: "vermogen" },

  { vraag: "Hoeveel staat er op mijn rekening?",              hoort: "rekeningsaldo" },
  { vraag: "Wat is mijn saldo?",                              hoort: "rekeningsaldo" },

  /* ------------------------------ Uitleg --------------------------- */
  { vraag: "Wat kan ik vragen?",                              hoort: "hulp" },
  { vraag: "Wat weet je allemaal?",                           hoort: "hulp" },

  /* --------------- Hier hoort géén antwoord op te komen ------------- */
  { vraag: "Wat vind jij van bitcoin?",                       hoort: null },
  { vraag: "Wat is de hoofdstad van Frankrijk?",              hoort: null },
  { vraag: "Moet ik gaan beleggen?",                          hoort: null },
  { vraag: "Hoe laat is het?",                                hoort: null },
];

/* ---------------------------------------------------------------
   Een verzonnen huishouden om de vragen op los te laten
   ---------------------------------------------------------------
   Dit wordt alleen in het geheugen gezet. Er wordt niets opgeslagen en
   niets van jou aangeraakt — je eigen cijfers blijven staan waar ze
   staan. Zie de uitleg boven in vragen.html.
   --------------------------------------------------------------- */
export function proefHuishouden(state, maandNu, maandPlus) {
  const nu = maandNu();
  const vorige = maandPlus(nu, -1);
  const dag = (maand, d) => `${maand}-${String(d).padStart(2, "0")}`;

  const potje = (id, naam, soort, maandelijks, icoon, extra = {}) => ({
    id, naam, soort, maandelijks, icoon, kleur: "#3ddc97",
    actief: true, startMaand: "2000-01", subpotjes: [], doelBedrag: null,
    bijgewerkt: 1, ...extra,
  });

  state.potjes = [
    potje("p-vast", "Vaste lasten", "vast", 1380, "🏠", {
      subpotjes: [{ id: "s1", naam: "Hypotheek", bedrag: 1200 },
                  { id: "s2", naam: "Energie", bedrag: 180 }],
    }),
    potje("p-bood", "Boodschappen", "vrij", 400, "🛒"),
    potje("p-uit", "Uitgaan", "vrij", 100, "🍽️"),
    potje("p-vak", "Vakantie", "sparen", 200, "✈️", { doelBedrag: 2500 }),
  ];

  state.terugkerend = [
    { id: "v-sal", naam: "Salaris", bedrag: 3000, soort: "inkomst",
      categorie: "cat-salaris", ritme: "maand", dag: 24, actief: true, bijgewerkt: 1 },
    { id: "v-ene", naam: "Energie", bedrag: 180, soort: "uitgave",
      categorie: "cat-wonen", ritme: "maand", dag: 28, actief: true, bijgewerkt: 1 },
  ];

  state.rekeningen = [
    { id: "r-1", naam: "Betaalrekening", soort: "betaal", beginsaldo: 2500,
      telMee: true, volgorde: 0, bijgewerkt: 1 },
  ];

  state.doelen = [
    { id: "d-1", naam: "Nieuwe auto", icoon: "🎯", doelBedrag: 8000,
      startBedrag: 0, streefDatum: "2027-06-01", bijgewerkt: 1 },
  ];

  const boeking = (id, datum, bedrag, omschrijving, soort, pot = "", doel = "") => ({
    id, datum, bedrag, omschrijving, soort, potje: pot, doel,
    categorie: "", rekening: "r-1", bijgewerkt: 1,
  });

  state.transacties = [
    boeking("t1", dag(nu, 3), 250, "Albert Heijn", "uitgave", "p-bood"),
    boeking("t2", dag(nu, 9), 120, "Jumbo", "uitgave", "p-bood"),
    boeking("t3", dag(nu, 12), 60, "Cafe de Hoek", "uitgave", "p-uit"),
    boeking("t4", dag(nu, 14), 89.95, "Bol.com", "uitgave"),
    boeking("t5", dag(nu, 15), 34.2, "Shell", "uitgave"),
    boeking("t6", dag(nu, 2), 200, "Inleg vakantie", "sparen", "p-vak", "d-1"),
    boeking("t7", dag(nu, 24), 3000, "Salaris", "inkomst"),
    boeking("t8", dag(vorige, 5), 310, "Albert Heijn", "uitgave", "p-bood"),
    boeking("t9", dag(vorige, 24), 3000, "Salaris", "inkomst"),
  ];

  state.maand = nu;
  state.instellingen = { ...state.instellingen, koppeling: { aan: false, potje: "" } };
}
