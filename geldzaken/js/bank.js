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

const SLEUTEL = "bank";

export const bank = {
  geladen: false,
  adres: "",            // het adres van je eigen dienst
  woord: "",            // het afgesproken woord
  sessie: "",           // je sessie bij de bank, na het koppelen
  bankNaam: "",
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
    const bewaard = await dbHaal(LOKAAL, SLEUTEL);
    if (bewaard) Object.assign(bank, bewaard, { bezig: false, fout: null });
  } catch { /* geen opslag: dan werkt de koppeling deze sessie niet */ }
  bank.geladen = true;
  return bank;
}

async function bewaar() {
  const { geladen, bezig, fout, ...rest } = bank;
  try { await dbZet(LOKAAL, { id: SLEUTEL, ...rest }); }
  catch { /* zonder opslag blijft het bij deze sessie */ }
}

export async function zetInstellingen({ adres, woord, aiAan }) {
  const voor = bank.adres + "|" + bank.woord;
  if (adres !== undefined) bank.adres = String(adres).trim().replace(/\/+$/, "");
  if (woord !== undefined) bank.woord = String(woord).trim();
  if (aiAan !== undefined) bank.aiAan = !!aiAan;
  bank.fout = null;
  /* Verander je adres of woord, dan zegt een oude uitslag niets meer. */
  if (voor !== bank.adres + "|" + bank.woord) bank.proef = null;
  await bewaar();
}

/* Alles weg: de koppeling, het woord, het adres. */
export async function vergeetAlles() {
  Object.assign(bank, {
    adres: "", woord: "", sessie: "", bankNaam: "", rekening: "",
    rekeningNaam: "", geldigTot: "", laatst: 0, aiAan: false, fout: null, proef: null,
  });
  try { await dbWis(LOKAAL, SLEUTEL); } catch { /* niets aan te doen */ }
}

/* ---------------------------------------------------------------
   Praten met de dienst
   --------------------------------------------------------------- */
async function roep(pad, { methode = "GET", lijf = null } = {}) {
  if (!ingesteld()) throw new Error("Vul eerst het adres en het woord van je bankdienst in.");

  let antwoord;
  try {
    antwoord = await fetch(bank.adres + pad, {
      method: methode,
      headers: {
        Authorization: `Bearer ${bank.woord}`,
        ...(lijf ? { "Content-Type": "application/json" } : {}),
      },
      body: lijf ? JSON.stringify(lijf) : undefined,
    });
  } catch {
    /* De browser vertelt niet óf het adres onbereikbaar was óf dat het
       antwoord om een andere reden niet doorkwam. In de praktijk is dat
       tweede bijna altijd HERKOMST: staat dit adres daar niet bij, dan
       laat de browser het antwoord niet door en ziet het er hetzelfde
       uit als een verkeerd adres. Dus noemen we ze allebei. */
    throw new Error(`De dienst antwoordde niet. Klopt het adres, en staat ${location.origin} in HERKOMST?`);
  }

  let gegevens = null;
  try { gegevens = await antwoord.json(); } catch { /* geen JSON */ }

  if (!antwoord.ok) {
    if (antwoord.status === 401) throw new Error("Het woord klopt niet met dat van de dienst.");
    if (antwoord.status === 403) throw new Error(gegevens?.fout || "De dienst laat dit adres niet toe.");
    throw new Error(gegevens?.fout || "De bankdienst gaf een fout terug.");
  }
  return gegevens || {};
}

export async function proefVerbinding() {
  try {
    await roep("/status");
    bank.proef = { gelukt: true, tekst: "De dienst antwoordt.", tijd: Date.now() };
    await bewaar();
    return true;
  } catch (fout) {
    bank.proef = { gelukt: false, tekst: fout.message, tijd: Date.now() };
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

  bank.sessie = waarde;
  bank.fout = null;
  await bewaar();

  /* Meteen ophalen welke rekeningen erbij zitten; hoort er één bij, dan
     kiezen we die vast. */
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
  return "gekoppeld";
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
