/* =====================================================================
   GELDZAKEN — de bankkoppeling, kant van de app
   =====================================================================
   Praat met de dienst in ../bank/worker.js, die bij Enable Banking de
   transacties van je eigen rekening ophaalt. Wat hier staat is bewust
   dun: ondertekenen, sleutels en bankprotocollen gebeuren allemaal in
   die dienst, want die draait niet in een browser die iedereen kan
   openmaken.

   Twee dingen die hier anders zijn dan in de rest van de app:

   - De instellingen (adres en woord) en je sessie bij de bank staan in
     de store `apparaat`, en die gaat nooit mee naar de cloud. Ze horen
     bij dít apparaat. Op je telefoon vul je ze apart in.

   - Er komt niets binnen zonder dat jij het ziet. Wat opgehaald wordt
     gaat naar het nakijkscherm van het inlezen, net als een CSV. Pas
     als jij op "Toevoegen" drukt staat het in je boekhouding.
   ===================================================================== */

import { dbHaal, dbZet, dbWis, LOKAAL } from "./db.js";
import { meld } from "./store.js";
import { spoorBij } from "./util.js";

const SLEUTEL = "bank";

/* Opslag en netwerk mogen nooit blíjven hangen. Safari in een
   geïnstalleerde app kan een IndexedDB-opdracht laten staan zonder ooit
   te antwoorden of te falen; wachten we daarop, dan doet een knop
   zichtbaar niets en weet je niet waarom. Dus zetten we overal een klok
   op. Liever een eerlijke foutmelding dan een stilte. */
const metKlok = (belofte, ms, waarover) => Promise.race([
  belofte,
  new Promise((_, mislukt) => setTimeout(() => mislukt(new Error(waarover)), ms)),
]);

export const bank = {
  geladen: false,
  adres: "",            // het adres van je eigen dienst
  woord: "",            // het afgesproken woord
  sessie: "",           // je sessie bij de bank, na het koppelen
  /* Een sessie die binnenkwam op een plek zonder adres en woord — in de
     praktijk: je bank stuurde je browser terug in plaats van de app op
     je beginscherm. Over te dragen met een code. */
  overdracht: "",
  bankNaam: "",
  dienstVersie: "",     // welke versie je eigen dienst draait
  rekening: "",         // welke rekening je volgt
  rekeningNaam: "",
  geldigTot: "",        // wanneer de toestemming verloopt
  laatst: 0,            // wanneer er voor het laatst is opgehaald
  aiAan: false,         // mag een niet-herkende vraag naar Claude?
  bezig: false,
  fout: null,
  /* De uitslag van de laatste proef, zodat "het werkt" ook iets
     achterlaat. Een melding die na drie tellen verdwijnt is niet te
     onderscheiden van niets. */
  proef: null,          // { gelukt, tekst, tijd }
  /* Kon er op dit apparaat überhaupt iets bewaard worden? In de
     privémodus van sommige browsers niet, en dan is het beter dat de
     app dat zegt dan dat alles stil blijft. */
  opslag: null,         // null = nog niet geprobeerd, true/false daarna
};

/* De dienst in bank/worker.js hoort minstens zo nieuw te zijn als dit.
   Hij wordt met de hand neergezet en kan dus achterlopen op de app; dan
   mist hij reparaties die hier allang zijn gedaan en zoek je een fout op
   de verkeerde plek. Ophogen zodra de app iets nodig heeft dat alleen in
   een nieuwere dienst zit. */
export const DIENST_NODIG = 28;

const versieNummer = v => {
  const m = /^v(\d+)$/.exec(String(v || "").trim());
  return m ? Number(m[1]) : null;
};

/* Alleen waar als we het zéker weten. Een dienst die zijn versie niet
   noemt is oud, maar dat zeggen we pas als hij het zelf vertelt — en
   anders laat de verbindingstest het vanzelf zien. */
export const dienstVerouderd = () => {
  const n = versieNummer(bank.dienstVersie);
  return n !== null && n < DIENST_NODIG;
};

export const ingesteld = () => !!(bank.adres && bank.woord);
export const gekoppeld = () => ingesteld() && !!bank.sessie;

/* Hoeveel dagen is de toestemming nog geldig? Null als we het niet
   weten. Onder de twee weken gaan we erover beginnen. */
export function dagenGeldig() {
  if (!bank.geldigTot) return null;
  const tot = Date.parse(bank.geldigTot);
  if (!isFinite(tot)) return null;
  return Math.ceil((tot - Date.now()) / 86400_000);
}

/* ---------------------------------------------------------------
   Bewaren op dit apparaat
   --------------------------------------------------------------- */
export async function laad() {
  if (bank.geladen) return bank;
  try {
    const bewaard = await metKlok(dbHaal(LOKAAL, SLEUTEL), 3000, "opslag antwoordt niet");
    if (bewaard) Object.assign(bank, bewaard, { bezig: false, fout: null });
    bank.opslag = true;
  } catch {
    /* Geen opslag — bijvoorbeeld een database die nog op de oude versie
       staat omdat de app ergens anders nog openstaat. Alles werkt dan
       nog wel, maar alleen tot je de app sluit. */
    bank.opslag = false;
  }
  bank.geladen = true;
  return bank;
}

async function bewaar() {
  const { geladen, bezig, fout, opslag, ...rest } = bank;
  const voor = bank.opslag;
  try { await metKlok(dbZet(LOKAAL, { id: SLEUTEL, ...rest }), 3000, "opslag antwoordt niet"); bank.opslag = true; }
  catch { bank.opslag = false; spoorBij("bewaren lukte niet (opslag antwoordt niet)"); }
  /* Slaat het om, dan hoort het scherm dat te laten zien. Het antwoord
     komt vaak pas als de knop zijn werk al heeft gedaan. */
  if (voor !== bank.opslag) meld();
}

export async function zetInstellingen({ adres, woord, aiAan, overdracht }) {
  const voor = bank.adres + "|" + bank.woord;
  if (adres !== undefined) bank.adres = String(adres).trim().replace(/\/+$/, "");
  if (woord !== undefined) bank.woord = String(woord).trim();
  if (aiAan !== undefined) bank.aiAan = !!aiAan;
  if (overdracht !== undefined) bank.overdracht = String(overdracht).trim();
  bank.fout = null;
  /* Verander je adres of woord, dan zegt een oude uitslag niets meer. */
  if (voor !== bank.adres + "|" + bank.woord) bank.proef = null;
  await bewaar();
}

/* Alles weg: de koppeling, het woord, het adres. */
export async function vergeetAlles() {
  Object.assign(bank, {
    adres: "", woord: "", sessie: "", overdracht: "", bankNaam: "", rekening: "",
    rekeningNaam: "", geldigTot: "", laatst: 0, aiAan: false, fout: null, proef: null,
  });
  try { await dbWis(LOKAAL, SLEUTEL); } catch { /* niets aan te doen */ }
}

/* ---------------------------------------------------------------
   Praten met de dienst
   --------------------------------------------------------------- */
async function roep(pad, { methode = "GET", lijf = null } = {}) {
  if (!ingesteld()) {
    spoorBij(`geen adres of woord bekend (adres ${bank.adres ? "ja" : "nee"}, woord ${bank.woord ? "ja" : "nee"})`);
    throw new Error("Vul eerst het adres en het woord van je bankdienst in.");
  }
  spoorBij(`verzoek ${methode} ${pad}`);

  let antwoord;
  /* Een verzoek dat nooit antwoordt laat de knop eeuwig op "Bezig…"
     staan. Twintig seconden is ruim; daarna weet je genoeg. */
  const afbreken = new AbortController();
  const klok = setTimeout(() => afbreken.abort(), 20000);
  try {
    antwoord = await fetch(bank.adres + pad, {
      method: methode,
      signal: afbreken.signal,
      headers: {
        Authorization: `Bearer ${bank.woord}`,
        ...(lijf ? { "Content-Type": "application/json" } : {}),
      },
      body: lijf ? JSON.stringify(lijf) : undefined,
    });
  } catch (fout) {
    /* De browser vertelt niet óf het adres onbereikbaar was óf dat het
       antwoord om een andere reden niet doorkwam. In de praktijk is dat
       tweede bijna altijd HERKOMST: staat dit adres daar niet bij, dan
       laat de browser het antwoord niet door en ziet het er hetzelfde
       uit als een verkeerd adres. Dus noemen we ze allebei. */
    spoorBij(fout?.name === "AbortError"
      ? "na 20 seconden nog geen antwoord"
      : `verzoek kwam niet aan: ${fout?.message || fout?.name || "onbekend"}`);
    /* Drie oorzaken geven hier precies hetzelfde beeld, en de browser
       zegt niet welke het is. Ze alle drie noemen is eerlijker dan er
       één uitlichten — en open je het adres zelf, dan zie je het meteen. */
    const stil = new Error(
      "De dienst antwoordde niet. Dat kan drie dingen betekenen: het adres klopt niet, "
      + "de dienst draait niet (opnieuw neergezet?), of "
      + `${location.origin} staat niet in HERKOMST. Open het adres hierboven in je browser — `
      + "dan zie je welke van de drie het is.");
    stil.geenAntwoord = true;   // er kwam écht niets terug, zie proefVerbinding
    throw stil;
  } finally {
    clearTimeout(klok);
  }
  spoorBij(`antwoord ${antwoord.status}`);

  let gegevens = null;
  try { gegevens = await antwoord.json(); } catch { /* geen JSON */ }

  if (!antwoord.ok) {
    if (antwoord.status === 401) {
      throw new Error("Het woord klopt niet met dat van de dienst. "
        + "Kijk of GELDZAKEN_WOORD in je dienst letterlijk hetzelfde is als hierboven.");
    }
    if (antwoord.status === 403) throw new Error(gegevens?.fout || "De dienst laat dit adres niet toe.");
    throw new Error(gegevens?.fout || "De bankdienst gaf een fout terug.");
  }
  return gegevens || {};
}

export async function proefVerbinding() {
  try {
    const uit = await roep("/status");
    /* De dienst zet je met de hand neer, dus hij kan achterlopen op de
       app zonder dat iets dat verraadt — en dan zoek je een fout die
       daar allang gerepareerd is. Dus vragen we het gewoon. */
    bank.dienstVersie = uit?.dienst || "";
    bank.proef = {
      gelukt: true,
      tekst: `De dienst antwoordt${uit?.dienst ? ` (${uit.dienst})` : ""}.`,
      tijd: Date.now(),
    };
    await bewaar();
    return true;
  } catch (fout) {
    /* Of de dienst zweeg dan wel antwoordde met een weigering is een
       wezenlijk verschil: het eerste wijst op het adres of HERKOMST, het
       tweede betekent dat je hem gewoon hebt bereikt. */
    bank.proef = { gelukt: false, tekst: fout.message, geenAntwoord: !!fout.geenAntwoord, tijd: Date.now() };
    await bewaar();
    throw fout;
  }
}

export async function welkeBanken(land = "NL") {
  const uit = await roep(`/banken?land=${encodeURIComponent(land)}`);
  return uit.banken || [];
}

/* ---------------------------------------------------------------
   Koppelen
   ---------------------------------------------------------------
   Je gaat naar je bank, logt daar in, en komt terug op dit adres met
   het sessienummer in het anker. Dat anker sturen browsers nooit naar
   een server, dus het nummer komt alleen hier terecht.
   --------------------------------------------------------------- */
export async function koppelStarten(bankNaam, land = "NL") {
  const terug = location.origin + location.pathname;
  const uit = await roep("/koppel", { methode: "POST", lijf: { bank: bankNaam, land, terug } });
  if (!uit.url) throw new Error("De dienst gaf geen inlogadres terug.");

  /* De naam alvast onthouden; na de terugkomst weten we anders niet
     meer bij welke bank je was. */
  bank.bankNaam = bankNaam;
  await bewaar();

  location.href = uit.url;
  return uit;
}

/* Wordt bij het opstarten aangeroepen, vóór de router. Staat er een
   sessie in het anker, dan slaan we die op en halen we het anker weg —
   anders blijft hij in je adresbalk en in je geschiedenis staan. */
export async function verwerkTerugkomst() {
  const anker = location.hash || "";
  if (!anker.startsWith("#bank=")) return null;

  const waarde = decodeURIComponent(anker.slice(6));
  history.replaceState(null, "", location.pathname + location.search + "#/instellingen");

  await laad();

  if (waarde === "afgebroken") { bank.fout = "Het koppelen is bij de bank afgebroken."; return "afgebroken"; }
  if (waarde === "mislukt" || !waarde) { bank.fout = "De bank gaf geen sessie terug."; return "mislukt"; }

  /* Ging het onderweg mis, dan komt de reden mee terug. Zonder dat zou
     je op een kale pagina van de dienst zijn blijven staan, zonder weg
     terug en zonder te weten waarom — net nadat je het hele inloggen
     bij je bank hebt doorlopen. */
  if (waarde.startsWith("fout:")) {
    bank.fout = waarde.slice(5) || "Het koppelen lukte niet.";
    bank.proef = { gelukt: false, tekst: bank.fout, geenAntwoord: false, koppelen: true, tijd: Date.now() };
    spoorBij(`terug van de bank met een fout: ${bank.fout}`);
    await bewaar();
    return "mislukt";
  }

  /* Hier komt bijna iedereen met een iPhone terecht.

     Je begint het koppelen in de app op je beginscherm, maar je bank
     stuurt je browser terug — en op iOS is dat Safari, met een eigen
     opslag die niets weet van wat er in die app staat. De sessie landt
     dus op de ene plek en het adres en het woord op de andere, en dan
     gaat er niets meer.

     Weggooien zou zonde zijn: het inloggen met je kaartlezer is gelukt
     en deze sessie is geldig. Dus bewaren we hem als iets om over te
     dragen, en laat het scherm zien hoe. */
  if (!ingesteld()) {
    bank.overdracht = waarde;
    bank.fout = null;
    spoorBij("sessie binnengekomen zonder adres en woord — over te dragen");
    /* Wel bewaren: herlaad je deze pagina, dan zou de code anders weg
       zijn en kun je alleen nog opnieuw beginnen. Hier is hij ook niets
       waard — zonder het adres en het woord kun je er niets mee. */
    await bewaar();
    return "overdracht";
  }

  await zetSessie(waarde);
  return "gekoppeld";
}

/* Een sessie in gebruik nemen: bewaren, en meteen kijken welke
   rekeningen eraan hangen. Hoort er maar één bij, dan kiezen we die
   vast. Dit loopt langs twee kanten binnen — recht van de bank terug,
   en overgenomen uit een andere browser — dus staat het hier apart. */
async function zetSessie(sessie) {
  bank.sessie = sessie;
  bank.overdracht = "";
  bank.fout = null;
  await bewaar();

  try {
    const { rekeningen, bank: naam, geldigTot } = await haalRekeningen();
    if (naam) bank.bankNaam = naam;
    if (geldigTot) bank.geldigTot = geldigTot;
    if (rekeningen.length === 1) {
      bank.rekening = rekeningen[0].id;
      bank.rekeningNaam = rekeningen[0].iban || rekeningen[0].naam || "";
    }
    await bewaar();
  } catch (e) {
    bank.fout = e.message;
  }
}

/* De code die je in je browser kreeg hier in gebruik nemen. */
export async function neemOver(code) {
  const schoon = String(code || "").trim();
  if (!/^[\w-]{1,100}$/.test(schoon)) {
    throw new Error("Dat lijkt geen geldige code. Neem hem helemaal over, zonder spaties.");
  }
  if (!ingesteld()) {
    throw new Error("Vul eerst het adres en het woord van je bankdienst in.");
  }
  spoorBij("sessie overgenomen uit een andere browser");
  await zetSessie(schoon);
  if (bank.fout) throw new Error(bank.fout);
  return true;
}

export async function haalRekeningen() {
  const uit = await roep("/rekeningen", { methode: "POST", lijf: { sessie: bank.sessie } });
  return { rekeningen: uit.rekeningen || [], bank: uit.bank || "", geldigTot: uit.geldigTot || "" };
}

export async function kiesRekening(id, naam = "") {
  bank.rekening = id;
  bank.rekeningNaam = naam;
  await bewaar();
}

export async function loskoppelen() {
  if (bank.sessie) {
    /* Lukt het intrekken niet, dan vergeten we hem hier toch — de
       toestemming verloopt vanzelf. */
    try { await roep("/loskoppelen", { methode: "POST", lijf: { sessie: bank.sessie } }); }
    catch { /* niet erg */ }
  }
  Object.assign(bank, { sessie: "", rekening: "", rekeningNaam: "", geldigTot: "", laatst: 0 });
  await bewaar();
}

/* ---------------------------------------------------------------
   Ophalen
   --------------------------------------------------------------- */
export async function haalTransacties({ vanaf = null, alles = false } = {}) {
  if (!gekoppeld()) throw new Error("Er is nog geen bankrekening gekoppeld.");
  if (!bank.rekening) throw new Error("Kies eerst welke rekening je wilt volgen.");

  bank.bezig = true;
  bank.fout = null;
  try {
    const uit = await roep("/transacties", {
      methode: "POST",
      lijf: { sessie: bank.sessie, rekening: bank.rekening, vanaf, alles },
    });
    bank.laatst = Date.now();
    await bewaar();
    return { transacties: uit.transacties || [], afgekapt: !!uit.afgekapt };
  } catch (e) {
    bank.fout = e.message;
    throw e;
  } finally {
    bank.bezig = false;
  }
}

/* ---------------------------------------------------------------
   Een vraag voorleggen aan Claude
   ---------------------------------------------------------------
   Alleen als jij dat hebt aangezet, en alleen met de samenvatting die
   vraag.js maakt: cijfers per potje, je inkomen, je doelen. Geen losse
   boekingen, geen namen van winkels, geen rekeningnummers. Wat er
   precies overheen gaat kun je nalezen in `samenvatting()`.
   --------------------------------------------------------------- */
export async function vraagAanAI(vraag, eerder = []) {
  if (!bank.aiAan) throw new Error("Claude staat uit.");
  const { samenvatting } = await import("./vraag.js");

  const uit = await roep("/vraag", {
    methode: "POST",
    lijf: { vraag, eerder, samenvatting: samenvatting() },
  });
  if (!uit.antwoord) throw new Error("Er kwam geen antwoord terug.");
  return uit.antwoord;
}
