/* =====================================================================
   GELDZAKEN — bankkoppeling, de tussenlaag
   =====================================================================
   Enable Banking geeft toegang tot je eigen bankrekening via één API
   voor alle Europese banken. Die API wil een JWT dat ondertekend is met
   een RSA-privésleutel. Hun eigen documentatie zegt er onomwonden bij:
   die sleutel hoort niet in een browser thuis.

   Geldzaken is een map met bestanden in een openbare repo. Alles wat
   daarin staat kan iedereen lezen. Daarom staat dit stukje er apart
   naast, draait het bij Cloudflare, en kent alleen jij de sleutel.

   Drie keuzes die hier de veiligheid bepalen:

   - Hij onthoudt niets. Geen database, geen bestanden, geen logboek met
     bedragen. Hij ondertekent, haalt op, geeft door en vergeet. Wat er
     niet ligt, kan ook niet uitlekken. Je sessie bij de bank bewaar je
     in de app zelf, op je eigen apparaat, en stuur je bij elk verzoek
     mee.

   - Hij praat alleen met jouw app. Eén afgesproken woord dat jij in
     allebei invult, en een vaste lijst met adressen waarvandaan hij
     antwoord geeft. Staat je verzoek daar niet bij, dan krijg je niets
     te zien — ook niet wat er misging.

   - Hij leest alleen. Er zit geen enkel pad in dat een betaling kan
     doen, hoe de API dat ook toestaat.

   Opzetten staat in README.md ernaast. Je hebt nodig:

     EB_APP_ID        het app-nummer uit het Enable Banking-portaal
     EB_SLEUTEL       de privésleutel (PKCS#8-PEM), als secret
     GELDZAKEN_WOORD  het afgesproken woord, als secret
     HERKOMST         https://jouwnaam.github.io  (komma's voor meerdere)
   ===================================================================== */

const API = "https://api.enablebanking.com";
const UUR = 3600;

/* Welke versie van dit bestand hier draait.
   ---------------------------------------------------------------
   De dienst wordt met de hand neergezet, dus hij kan achterlopen op de
   app zonder dat iets dat verraadt — en dan zoek je een fout die hier
   allang gerepareerd is. Daarom zegt hij het zelf, op de twee plekken
   die je zonder iets in te vullen kunt zien: /status, en de weigering
   die je krijgt als je het adres gewoon in je browser opent.

   Ophogen bij elke wijziging die je moet neerzetten. */
const VERSIE = "v29";

/* Hoe lang de toestemming bij de bank geldig is. Zes maanden is wat de
   meeste banken maximaal toestaan; is jouw bank strenger, dan nemen we
   die grens over. Daarna moet je opnieuw inloggen bij de bank — dat is
   een wettelijke eis, daar komen we niet onderuit. */
const TOESTEMMING_DAGEN = 180;

/* Eén ronde ophalen pakt hooguit dit aantal pagina's. Een rem voor het
   geval een bank blijft doorverwijzen. */
const MAX_PAGINAS = 25;

export default {
  async fetch(verzoek, omgeving) {
    const url = new URL(verzoek.url);
    const herkomst = verzoek.headers.get("Origin") || "";
    const mag = magHerkomst(herkomst, omgeving);

    /* De voorvraag laten we altijd door. Niet omdat iedereen erbij mag —
       dat regelt `mag` hieronder, en zonder dat komt er geen enkel pad
       aan bod — maar omdat een geweigerde voorvraag het echte verzoek
       al tegenhoudt. De app ziet dan geen weigering maar stilte, en
       stilte leest als "onbereikbaar": je gaat het adres nakijken
       terwijl HERKOMST de boosdoener is. Laat het verzoek dus komen en
       antwoord met een zin die ergens op slaat. */
    if (verzoek.method === "OPTIONS") return voorvraag(herkomst || "*");

    try {
      /* Ontbreekt er iets aan de instellingen, dan doen we niets. Liever
         een duidelijke fout bij het opzetten dan een dienst die half
         werkt. */
      ontbreekt(omgeving);

      /* De terugkomst van de bank is het enige pad zonder afgesproken
         woord: de bank stuurt je browser hierheen en kent dat woord
         niet. Wat het beschermt is de ondertekende `state` die wij zelf
         hebben meegegeven — zonder die handtekening gebeurt er niets. */
      if (url.pathname === "/klaar") return await terugVanBank(url, omgeving);

      /* De weigering gaat terug mét kopteksten, zodat de app hem kan
         lezen en kan zéggen wat er mis is. Dat geeft niets prijs: wie
         hier niet bij mag komt langs geen enkel pad, en dit antwoord
         bevat niets dan die mededeling. */
      if (!mag) {
        return antwoord({
          fout: `Dit adres mag hier niet bij. Zet ${herkomst || "het adres van je app"} in HERKOMST.`,
          dienst: VERSIE,
        }, 403, herkomst);
      }
      if (!await woordKlopt(verzoek, omgeving)) {
        return antwoord({ fout: "Verkeerd of ontbrekend woord." }, 401, herkomst);
      }

      if (url.pathname === "/status" && verzoek.method === "GET") {
        return antwoord({ klaar: true, dienst: VERSIE }, 200, herkomst);
      }
      if (url.pathname === "/banken" && verzoek.method === "GET") {
        return antwoord(await banken(url, omgeving), 200, herkomst);
      }
      if (url.pathname === "/koppel" && verzoek.method === "POST") {
        return antwoord(await koppelStarten(verzoek, url, omgeving), 200, herkomst);
      }
      /* De code van je bank inwisselen voor een sessie. Dit hoort hier
         en niet bij /klaar: het mag maar één keer gebeuren, en dan moet
         de app het vragen in plaats van een browser die een adres
         ophaalt. */
      if (url.pathname === "/sessie" && verzoek.method === "POST") {
        return antwoord(await maakSessie(verzoek, omgeving), 200, herkomst);
      }
      if (url.pathname === "/rekeningen" && verzoek.method === "POST") {
        return antwoord(await rekeningen(verzoek, omgeving), 200, herkomst);
      }
      if (url.pathname === "/transacties" && verzoek.method === "POST") {
        return antwoord(await transacties(verzoek, omgeving), 200, herkomst);
      }
      if (url.pathname === "/loskoppelen" && verzoek.method === "POST") {
        return antwoord(await loskoppelen(verzoek, omgeving), 200, herkomst);
      }
      if (url.pathname === "/vraag" && verzoek.method === "POST") {
        return antwoord(await vraag(verzoek, omgeving), 200, herkomst);
      }

      return antwoord({ fout: "Onbekend pad." }, 404, herkomst);
    } catch (e) {
      /* Naar buiten alleen wat je ermee kunt: een nette zin. Wat er
         precies misging blijft in het logboek van Cloudflare, zonder
         bedragen of namen. */
      console.error("bank:", e?.code || e?.message || "onbekende fout");
      /* Een fout in de instellingen gaat altijd leesbaar terug, ook naar
         een herkomst die we niet kennen — want juist dán kán HERKOMST
         degene zijn die ontbreekt. Het verraadt niets: het zegt alleen
         welke instelling nog mist, en zonder die instellingen doet de
         dienst sowieso niets. */
      const naar = mag ? herkomst : e?.instelling ? "*" : "";
      return antwoord({ fout: e?.publiek || "Er ging iets mis bij het ophalen.", dienst: VERSIE },
                      e?.status || 500, naar);
    }
  },
};

/* ---------------------------------------------------------------
   Instellingen en herkomst
   --------------------------------------------------------------- */
function ontbreekt(omgeving) {
  for (const naam of ["EB_APP_ID", "EB_SLEUTEL", "GELDZAKEN_WOORD", "HERKOMST"]) {
    if (!omgeving[naam]) {
      const e = mis(`Instelling ${naam} ontbreekt.`, 500);
      /* Deze fout moet de app kunnen lézen. Zonder dat merk komt hij
         terug zonder de kopteksten die een browser verlangt, en ziet de
         app geen melding maar stilte — waarna hij je naar het adres en
         HERKOMST stuurt, terwijl daar niets mis mee is. Zie `fetch`. */
      e.instelling = true;
      throw e;
    }
  }
}

/* Is er aan de instellingen iets mis, dan kan de dienst toch niets
   uitvoeren: elk pad zit achter `ontbreekt`. Een voorvraag doorlaten
   geeft dus niets weg en levert wel een leesbare uitleg op. */
const instellingenCompleet = omgeving =>
  ["EB_APP_ID", "EB_SLEUTEL", "GELDZAKEN_WOORD", "HERKOMST"].every(n => !!omgeving[n]);

/* Een hostnaam kent geen hoofdletters: `Example.com` en `example.com`
   zijn dezelfde plek. Browsers sturen hun herkomst altijd in kleine
   letters mee, dus een HERKOMST die met een hoofdletter is ingetikt —
   en een GitHub-naam heeft die vaak — zou nooit matchen. Dat verschil
   is niet te zien en kost je een avond, dus halen we het weg. */
const plat = s => String(s).trim().replace(/\/+$/, "").toLowerCase();

const herkomsten = omgeving =>
  String(omgeving.HERKOMST || "").split(",").map(plat).filter(Boolean);

const magHerkomst = (herkomst, omgeving) =>
  !!herkomst && herkomsten(omgeving).includes(plat(herkomst));

/* Het afgesproken woord vergelijken zonder te verraden hoever je zat.
   Een gewone vergelijking stopt bij het eerste verschil, en met genoeg
   pogingen is daar een woord uit te raden. */
async function woordKlopt(verzoek, omgeving) {
  const kop = verzoek.headers.get("Authorization") || "";
  const gegeven = kop.startsWith("Bearer ") ? kop.slice(7) : "";
  if (!gegeven) return false;

  /* Het woord aan beide kanten ontdaan van wat eromheen staat. Een
     secret wordt geplakt, en een plakbeurt sleept makkelijk een spatie
     of een regeleinde mee. Dat verschil is onzichtbaar en kost je een
     middag: het woord lijkt dan precies goed en klopt toch nooit.
     Veiligheid verliezen we er niet mee — spaties aan de rand dragen
     niets bij. */
  const [a, b] = await Promise.all([
    hash(gegeven.trim()),
    hash(String(omgeving.GELDZAKEN_WOORD).trim()),
  ]);
  if (a.length !== b.length) return false;
  let verschil = 0;
  for (let i = 0; i < a.length; i++) verschil |= a[i] ^ b[i];
  return verschil === 0;
}

async function hash(tekst) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst)));
}

/* ---------------------------------------------------------------
   Antwoorden
   --------------------------------------------------------------- */
function kopteksten(herkomst) {
  const k = {
    "Content-Type": "application/json; charset=utf-8",
    /* Niets hiervan mag ergens blijven hangen. */
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  if (herkomst) {
    k["Access-Control-Allow-Origin"] = herkomst;
    k["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    k["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    k["Access-Control-Max-Age"] = "86400";
    k["Vary"] = "Origin";
  }
  return k;
}

const antwoord = (gegevens, status = 200, herkomst = "") =>
  new Response(JSON.stringify(gegevens), { status, headers: kopteksten(herkomst) });

const voorvraag = herkomst => new Response(null, { status: 204, headers: kopteksten(herkomst) });

function mis(publiek, status = 400) {
  const e = new Error(publiek);
  e.publiek = publiek;
  e.status = status;
  return e;
}

/* ---------------------------------------------------------------
   Het JWT voor Enable Banking
   ---------------------------------------------------------------
   Een vers token per verzoek. Ze staan een dag toe, maar er is geen
   reden om er een te bewaren: ondertekenen kost niets en een token dat
   nergens ligt kan niet weglopen.
   --------------------------------------------------------------- */
const b64url = bytes =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlTekst = tekst => b64url(new TextEncoder().encode(tekst));

let sleutelBelofte = null;

function sleutel(omgeving) {
  if (sleutelBelofte) return sleutelBelofte;

  const pem = String(omgeving.EB_SLEUTEL);
  if (/BEGIN RSA PRIVATE KEY/.test(pem)) {
    throw mis("De sleutel staat in de oude vorm. Zet hem om met: " +
              "openssl pkcs8 -topk8 -nocrypt -in sleutel.pem -out sleutel.pk8.pem", 500);
  }

  const body = pem.replace(/-----[^-]*-----/g, "").replace(/\s+/g, "");
  let ruw;
  try {
    ruw = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  } catch {
    throw mis("De privésleutel is onleesbaar.", 500);
  }

  sleutelBelofte = crypto.subtle.importKey(
    "pkcs8", ruw.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  ).catch(() => { throw mis("De privésleutel kon niet worden gelezen.", 500); });

  return sleutelBelofte;
}

async function token(omgeving) {
  const nu = Math.floor(Date.now() / 1000);
  const kop = b64urlTekst(JSON.stringify({ typ: "JWT", alg: "RS256", kid: omgeving.EB_APP_ID }));
  const lijf = b64urlTekst(JSON.stringify({
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: nu,
    exp: nu + UUR,
  }));
  const handtekening = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", await sleutel(omgeving), new TextEncoder().encode(`${kop}.${lijf}`));
  return `${kop}.${lijf}.${b64url(handtekening)}`;
}

async function bij(omgeving, pad, opties = {}) {
  const antw = await fetch(API + pad, {
    ...opties,
    headers: {
      Authorization: `Bearer ${await token(omgeving)}`,
      ...(opties.body ? { "Content-Type": "application/json" } : {}),
      ...opties.headers,
    },
  });

  const tekst = await antw.text();
  let gegevens = null;
  try { gegevens = tekst ? JSON.parse(tekst) : null; } catch { /* geen JSON */ }

  if (!antw.ok) {
    /* Twee verschillende dingen, en ze stonden door elkaar.

       Een code is een naam waar we iets mee kunnen — EXPIRED_SESSION en
       dergelijke, waar hieronder een nette zin bij hoort. Maar Enable
       Banking zet in `code` soms gewoon het getal 400 neer, en dan kreeg
       je "(400 400)" te lezen: tweemaal hetzelfde en nergens goed voor.
       Wat je dan wél verder helpt staat in `message`, en dat gooiden we
       weg. Dus: alleen een naam telt als code, en de tekst gaat mee. */
    const naam = [gegevens?.code, gegevens?.error]
      .find(w => typeof w === "string" && /[a-z]/i.test(w)) || "";
    const zin = [gegevens?.message, gegevens?.detail, gegevens?.error_description, gegevens?.description]
      .find(w => typeof w === "string" && w.trim()) || "";
    throw mis(uitleg(antw.status, naam, zin), antw.status === 401 ? 502 : antw.status);
  }
  return gegevens;
}

/* De fouten die je in de praktijk tegenkomt, in gewone taal. */
function uitleg(status, code, zin = "") {
  if (code === "EXPIRED_SESSION" || status === 401) {
    return "De toestemming bij je bank is verlopen. Koppel je rekening opnieuw.";
  }
  if (code === "ASPSP_RATE_LIMIT_EXCEEDED" || status === 429) {
    return "Je bank staat even geen nieuwe ophaalronde toe. Probeer het over een paar uur weer.";
  }
  if (status === 403) return "Deze rekening is niet gekoppeld aan je Enable Banking-app.";
  if (status >= 500) return "Je bank of Enable Banking is even niet bereikbaar.";
  /* Wat hier overblijft kennen we niet bij naam. Dan is wat Enable
     Banking zelf teruggaf het enige bruikbare dat we hebben, en dat
     verzwijgen helpt niemand — het gaat om hun foutmelding, niet om een
     gegeven van jou. */
  const erbij = [code, (zin || "").trim().slice(0, 200)].filter(Boolean).join(": ");
  return `Ophalen lukte niet (${status}${erbij ? ` — ${erbij}` : ""}).`;
}

/* ---------------------------------------------------------------
   Banken
   --------------------------------------------------------------- */
async function banken(url, omgeving) {
  const land = (url.searchParams.get("land") || "NL").toUpperCase().slice(0, 2);
  const gegevens = await bij(omgeving, `/aspsps?country=${encodeURIComponent(land)}`);
  return {
    banken: (gegevens?.aspsps || []).map(a => ({
      naam: a.name,
      land: a.country,
      logo: a.logo || "",
      maxDagen: a.maximum_consent_validity
        ? Math.floor(Number(a.maximum_consent_validity) / 86400)
        : null,
    })),
  };
}

/* ---------------------------------------------------------------
   Koppelen: heen
   --------------------------------------------------------------- */
async function koppelStarten(verzoek, url, omgeving) {
  const { bank, land = "NL", terug } = await lijf(verzoek);
  if (!bank) throw mis("Geen bank gekozen.");

  /* Waar we je daarna heen sturen moet in de lijst staan. Zonder die
     controle kan iemand deze dienst gebruiken om bezoekers naar een
     eigen pagina te sturen, met je sessie erin. */
  const terugUrl = veiligTerug(terug, omgeving);

  /* Niet langer dan de bank toestaat, en niet langer dan nodig. */
  let dagen = TOESTEMMING_DAGEN;
  try {
    const lijst = await banken(new URL(`?land=${land}`, "https://x/"), omgeving);
    const gevonden = lijst.banken.find(b => b.naam === bank);
    if (gevonden?.maxDagen) dagen = Math.min(dagen, gevonden.maxDagen);
  } catch { /* lukt dat niet, dan proberen we het met 180 */ }

  const geldigTot = new Date(Date.now() + dagen * 86400_000).toISOString().replace(/\.\d+Z$/, ".000+00:00");

  const start = await bij(omgeving, "/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: geldigTot },
      aspsp: { name: bank, country: land },
      redirect_url: new URL("/klaar", url.origin).toString(),
      state: await maakState(terugUrl, omgeving),
      psu_type: "personal",
      language: "nl",
    }),
  });

  if (!start?.url) throw mis("De bank gaf geen inlogadres terug.", 502);
  return { url: start.url, dagen };
}

function veiligTerug(terug, omgeving) {
  const toegestaan = herkomsten(omgeving);
  let doel;
  try { doel = new URL(String(terug || "")); }
  catch { throw mis("Geen geldig terugkeeradres."); }
  if (!toegestaan.includes(doel.origin)) throw mis("Dat terugkeeradres staat niet in de lijst.", 403);
  /* Alleen het pad houden we over; wat er aan vragen of ankers achter
     stond gooien we weg, zodat er niets wordt binnengesmokkeld. */
  return doel.origin + doel.pathname;
}

/* De `state` gaat mee naar de bank en komt ongezien weer terug. Wij
   ondertekenen hem, zodat een terugkomst die wij niet zijn begonnen
   er meteen uit valt. Tien minuten is ruim genoeg om in te loggen. */
async function maakState(terug, omgeving) {
  const lading = b64urlTekst(JSON.stringify({ t: terug, v: Date.now() + 10 * 60 * 1000 }));
  return `${lading}.${await zegel(lading, omgeving)}`;
}

async function leesState(state, omgeving) {
  const [lading, meegegeven] = String(state || "").split(".");
  if (!lading || !meegegeven) throw mis("Onvolledige terugkomst.", 400);
  if (await zegel(lading, omgeving) !== meegegeven) throw mis("Deze terugkomst klopt niet.", 403);

  let uit;
  try { uit = JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(lading.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)))); }
  catch { throw mis("Deze terugkomst klopt niet.", 403); }

  if (!uit?.v || Date.now() > uit.v) throw mis("Het inloggen duurde te lang. Probeer het opnieuw.", 403);
  return uit;
}

async function zegel(tekst, omgeving) {
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(omgeving.GELDZAKEN_WOORD),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(tekst)));
}

/* ---------------------------------------------------------------
   Koppelen: terug
   ---------------------------------------------------------------
   De bank stuurt je browser hierheen. Wij ruilen de code in voor een
   sessie en sturen je door naar de app, met het sessienummer in het
   anker van het adres. Dat deel van een adres gaat nooit naar een
   server — ook niet naar die van GitHub Pages — dus het komt alleen in
   jouw browser terecht, die het in de app opslaat.
   --------------------------------------------------------------- */
async function terugVanBank(url, omgeving) {
  const fout = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  /* Zonder een geldige handtekening weten we niet waar we je veilig heen
     mogen sturen. Dán, en alleen dán, blijft het bij een melding hier. */
  const gelezen = await leesState(state, omgeving);
  const terug = gelezen.t;

  if (fout) return Response.redirect(`${terug}#bank=fout:${kort(fout)}`, 302);
  if (!code) return Response.redirect(`${terug}#bank=afgebroken`, 302);

  /* Hier werd de code ingewisseld voor een sessie, en dat was fout.

     Dit is een pagina die wordt opgehaald, en een adres mag meer dan
     eens worden opgehaald: een app die je naar je browser doorstuurt
     haalt hem vaak eerst zelf op, een browser herhaalt een verzoek bij
     terugnavigeren, en verversen doet het ook. De code van je bank is
     eenmalig. De eerste keer slaagde dus, en de keer die jij te zien
     kreeg hoorde "ALREADY_AUTHORIZED" — terwijl er niets mis was,
     behalve dat wij het twee keer deden.

     Een adres ophalen hoort niets te veranderen. Dus geven we de code
     door aan de app, en die wisselt hem één keer in, op een moment dat
     zij bepaalt. Deze pagina twee keer ophalen kan nu geen kwaad. */
  return Response.redirect(`${terug}#bankcode=${encodeURIComponent(code)}`, 302);
}

/* Een reden die in een anker past en er niets anders in smokkelt. */
const kort = tekst => encodeURIComponent(String(tekst).slice(0, 180));

/* De code inwisselen voor een sessie. Eén keer, op verzoek van de app. */
async function maakSessie(verzoek, omgeving) {
  const { code } = await lijf(verzoek);
  if (!code || typeof code !== "string") throw mis("Geen code meegekregen.");

  const sessie = await bij(omgeving, "/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  if (!sessie?.session_id) throw mis("De bank gaf geen sessie terug.", 502);
  return { sessie: sessie.session_id };
}

/* ---------------------------------------------------------------
   Rekeningen en transacties
   --------------------------------------------------------------- */
async function lijf(verzoek) {
  try { return await verzoek.json(); }
  catch { throw mis("Onleesbaar verzoek."); }
}

function sessieUit(gegevens) {
  const s = String(gegevens?.sessie || "").trim();
  if (!/^[\w-]{1,100}$/.test(s)) throw mis("Geen geldig sessienummer.");
  return s;
}

async function rekeningen(verzoek, omgeving) {
  const sessie = sessieUit(await lijf(verzoek));
  const gegevens = await bij(omgeving, `/sessions/${encodeURIComponent(sessie)}`);

  const lijst = (gegevens?.accounts_data || gegevens?.accounts || []).map(r => {
    const id = typeof r === "string" ? r : (r.uid || r.account_id || "");
    const details = typeof r === "string" ? {} : r;
    return {
      id,
      iban: details?.account_id?.iban || details?.iban || "",
      naam: details?.name || details?.product || details?.details || "",
      valuta: details?.currency || "EUR",
      /* Blijft gelijk als je opnieuw koppelt, in tegenstelling tot id. */
      kenmerk: details?.identification_hash || "",
    };
  }).filter(r => r.id);

  return {
    rekeningen: lijst,
    bank: gegevens?.aspsp?.name || "",
    geldigTot: gegevens?.access?.valid_until || null,
  };
}

async function transacties(verzoek, omgeving) {
  const gegevens = await lijf(verzoek);
  const sessie = sessieUit(gegevens);
  const rekening = String(gegevens?.rekening || "").trim();
  if (!/^[\w-]{1,100}$/.test(rekening)) throw mis("Geen geldige rekening.");

  const vanaf = /^\d{4}-\d{2}-\d{2}$/.test(gegevens?.vanaf || "") ? gegevens.vanaf : null;
  /* Bij de eerste ronde zoveel mogelijk historie; daarna is de gewone
     weg sneller en vriendelijker voor de bank. */
  const strategie = gegevens?.alles ? "longest" : "default";

  const uit = [];
  let sleutelVolgende = null;
  let ronde = 0;

  do {
    const vragen = new URLSearchParams({ strategy: strategie });
    if (vanaf) vragen.set("date_from", vanaf);
    if (sleutelVolgende) vragen.set("continuation_key", sleutelVolgende);

    const pagina = await bij(omgeving,
      `/accounts/${encodeURIComponent(rekening)}/transactions?${vragen}`);

    for (const t of pagina?.transactions || []) {
      const net = netjes(t);
      if (net) uit.push(net);
    }
    sleutelVolgende = pagina?.continuation_key || null;
  } while (sleutelVolgende && ++ronde < MAX_PAGINAS);

  /* Even goed zeggen dat er nog meer was, in plaats van stil afkappen. */
  return { transacties: uit, afgekapt: !!sleutelVolgende, sessie: undefined };
}

/* Eén transactie van Enable Banking naar wat Geldzaken nodig heeft.
   Alleen geboekte regels: een reservering van de pinautomaat verandert
   nog van bedrag en van kenmerk, en zou later dubbel binnenkomen. */
function netjes(t) {
  if (t?.status && t.status !== "BOOK") return null;

  const bedrag = Number(t?.transaction_amount?.amount);
  if (!isFinite(bedrag)) return null;

  const uitgave = t?.credit_debit_indicator === "DBIT";
  const tegen = uitgave ? t?.creditor : t?.debtor;
  const tegenRekening = uitgave ? t?.creditor_account : t?.debtor_account;

  const stukken = [
    tegen?.name || "",
    ...(Array.isArray(t?.remittance_information) ? t.remittance_information : []),
  ].map(s => String(s || "").trim()).filter(Boolean);

  return {
    ref: t?.entry_reference || "",
    datum: (t?.booking_date || t?.value_date || t?.transaction_date || "").slice(0, 10),
    bedrag: Math.abs(bedrag),
    soort: uitgave ? "uitgave" : "inkomst",
    omschrijving: [...new Set(stukken)].join(" — ").slice(0, 140),
    tegenpartij: String(tegen?.name || "").slice(0, 80),
    iban: String(tegenRekening?.iban || "").slice(0, 40),
    valuta: t?.transaction_amount?.currency || "EUR",
  };
}

/* Toestemming bij de bank intrekken. Niet verplicht — hij verloopt
   vanzelf — maar het hoort erbij dat je zelf de stekker eruit kunt
   trekken. */
async function loskoppelen(verzoek, omgeving) {
  const sessie = sessieUit(await lijf(verzoek));
  await bij(omgeving, `/sessions/${encodeURIComponent(sessie)}`, { method: "DELETE" });
  return { losgekoppeld: true };
}

/* ---------------------------------------------------------------
   Een vraag voorleggen aan Claude
   ---------------------------------------------------------------
   Optioneel, en standaard niet aan: zonder CLAUDE_SLEUTEL bestaat dit
   pad niet. De app stuurt een samenvatting in cijfers mee die hij zelf
   heeft samengesteld — geen losse boekingen, geen tegenpartijen, geen
   rekeningnummers. Wij geven die ongewijzigd door en sturen het
   antwoord terug. Ook hier wordt niets bewaard.
   --------------------------------------------------------------- */
const CLAUDE = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5-5";

async function vraag(verzoek, omgeving) {
  if (!omgeving.CLAUDE_SLEUTEL) {
    throw mis("Er is geen Claude-sleutel ingesteld in je bankdienst.", 501);
  }

  const { vraag: tekst, samenvatting, eerder = [] } = await lijf(verzoek);
  if (!tekst || String(tekst).length > 2000) throw mis("Geen bruikbare vraag.");
  if (!samenvatting || typeof samenvatting !== "object") throw mis("Geen samenvatting meegestuurd.");

  /* Het gesprek tot nu toe, maar met een rem erop: een lang gesprek
     kost geld en zegt zelden meer dan de laatste paar beurten. */
  const beurten = (Array.isArray(eerder) ? eerder : []).slice(-6)
    .filter(b => b && typeof b.tekst === "string" && b.tekst.length < 2000)
    .map(b => ({ role: b.rol === "assistant" ? "assistant" : "user", content: String(b.tekst) }));

  const opdracht =
    "Je helpt iemand met zijn eigen huishoudboekje in de app Geldzaken. " +
    "Antwoord in het Nederlands, in twee of drie zinnen, nuchter en zonder opsmuk. " +
    "Reken alleen met de cijfers hieronder; verzin er niets bij en zeg het als iets er niet in staat. " +
    "Bedragen in euro's met een komma als decimaalteken. " +
    "Geef geen financieel advies over beleggen, leningen of verzekeringen — " +
    "verwijs daarvoor naar een echte adviseur.\n\n" +
    "De cijfers van deze maand:\n" + JSON.stringify(samenvatting);

  const antw = await fetch(CLAUDE, {
    method: "POST",
    headers: {
      "x-api-key": omgeving.CLAUDE_SLEUTEL,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: omgeving.CLAUDE_MODEL || MODEL,
      max_tokens: 400,
      system: opdracht,
      messages: [...beurten, { role: "user", content: String(tekst) }],
    }),
  });

  if (!antw.ok) {
    if (antw.status === 401) throw mis("De Claude-sleutel wordt niet geaccepteerd.", 502);
    if (antw.status === 429) throw mis("Even te veel vragen achter elkaar. Probeer het zo weer.", 429);
    throw mis("Claude is nu niet bereikbaar.", 502);
  }

  const gegevens = await antw.json();
  const tekstUit = (gegevens?.content || [])
    .filter(d => d?.type === "text").map(d => d.text).join("").trim();

  return { antwoord: tekstUit || "Daar kan ik niets zinnigs over zeggen." };
}
