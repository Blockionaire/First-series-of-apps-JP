/* =====================================================================
   GELDZAKEN — de terugkomst van je bank
   =====================================================================
   Je hebt net het hele inloggen bij je bank doorlopen, met je
   kaartlezer erbij. Gaat er dán iets mis, dan is stranden op een kale
   pagina van de dienst het ergste wat er kan gebeuren: geen weg terug,
   en de app hoort nooit wat er misging.

   Dus: wat er ook misgaat, je komt terug in de app, mét de reden. Met
   één uitzondering — een terugkomst zonder geldige handtekening sturen
   we nergens heen, want dan weten we niet waar je veilig heen mag.

   Draaien:  node test/terugkomst.mjs   (vanuit de map geldzaken)
   ===================================================================== */

/* Kom je altijd terug in de app, ook als het misgaat? En staat de reden
   erbij? Juist na het inloggen bij je bank is stranden het ergste. */
import worker from "../bank/worker.js";
import { generateKeyPairSync } from "node:crypto";

/* De dienst ondertekent met een echte RSA-sleutel, dus die moet er zijn. */
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SLEUTEL = privateKey.export({ type: "pkcs8", format: "pem" });

const HERKOMST = "https://blockionaire.github.io";
const APP = `${HERKOMST}/First-series-of-apps-JP/geldzaken/`;
const omgeving = {
  EB_APP_ID: "proef", EB_SLEUTEL: SLEUTEL,
  GELDZAKEN_WOORD: "appelmoes", HERKOMST,
};

let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

/* De state onderscheppen uit het verzoek dat de dienst naar buiten doet. */
let laatsteState = "";
const echteFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const adres = String(u?.url || u);
  if (adres.endsWith("/auth")) {
    laatsteState = JSON.parse(o.body).state;
    return new Response(JSON.stringify({ url: "https://bank.test/inloggen" }), { status: 200 });
  }
  if (adres.includes("/aspsps")) {
    return new Response(JSON.stringify({ aspsps: [{ name: "Rabobank", country: "NL" }] }), { status: 200 });
  }
  if (adres.endsWith("/sessions")) return sessieAntwoord();
  return new Response("{}", { status: 200 });
};
let sessieAntwoord = () => new Response(JSON.stringify({ session_id: "sess-123" }), { status: 200 });

await worker.fetch(new Request("https://dienst.test/koppel", {
  method: "POST",
  headers: { Origin: HERKOMST, Authorization: "Bearer appelmoes", "Content-Type": "application/json" },
  body: JSON.stringify({ bank: "Rabobank", land: "NL", terug: APP }),
}), omgeving);
check("we hebben een ondertekende state", !!laatsteState);

const klaar = async (zoekers) => worker.fetch(
  new Request(`https://dienst.test/klaar?${zoekers}`), omgeving);

/* 1. Het gewone geval: de code gaat door naar de app, die hem inwisselt. */
let r = await klaar(`code=abc&state=${encodeURIComponent(laatsteState)}`);
check("gelukt: terug naar de app met de code",
  r.status === 302 && r.headers.get("Location") === `${APP}#bankcode=abc`, r.headers.get("Location"));

/* 1b. En dit is waar het eerder op stukliep: een app die je naar je
       browser doorstuurt haalt dat adres vaak eerst zelf op, en een
       browser herhaalt een verzoek bij terugnavigeren. Toen werd de
       eenmalige code van je bank twee keer ingewisseld en kreeg je
       ALREADY_AUTHORIZED te zien. Nu verandert ophalen niets, dus mag
       het zo vaak als het wil. */
let keer = 0;
const tellen = sessieAntwoord;
sessieAntwoord = () => { keer++; return tellen(); };
await klaar(`code=abc&state=${encodeURIComponent(laatsteState)}`);
await klaar(`code=abc&state=${encodeURIComponent(laatsteState)}`);
await klaar(`code=abc&state=${encodeURIComponent(laatsteState)}`);
check("drie keer ophalen wisselt nog steeds niets in", keer === 0, `${keer} keer`);

/* 1c. De app wisselt hem in, via een eigen pad dat het woord vraagt. */
sessieAntwoord = () => new Response(JSON.stringify({ session_id: "sess-123" }), { status: 200 });
const sessieR = await worker.fetch(new Request("https://dienst.test/sessie", {
  method: "POST",
  headers: { Origin: HERKOMST, Authorization: "Bearer appelmoes", "Content-Type": "application/json" },
  body: JSON.stringify({ code: "abc" }),
}), omgeving);
check("de app krijgt de sessie", sessieR.status === 200 && (await sessieR.clone().json()).sessie === "sess-123");

const zonderWoord = await worker.fetch(new Request("https://dienst.test/sessie", {
  method: "POST",
  headers: { Origin: HERKOMST, "Content-Type": "application/json" },
  body: JSON.stringify({ code: "abc" }),
}), omgeving);
check("maar niet zonder het woord", zonderWoord.status === 401, String(zonderWoord.status));

/* 2. Enable Banking weigert de code. Dat komt nu via /sessie terug, waar
      de app er iets mee kan. */
const inwisselen = async () => {
  const a = await worker.fetch(new Request("https://dienst.test/sessie", {
    method: "POST",
    headers: { Origin: HERKOMST, Authorization: "Bearer appelmoes", "Content-Type": "application/json" },
    body: JSON.stringify({ code: "abc" }),
  }), omgeving);
  return { status: a.status, fout: (await a.json()).fout || "" };
};

sessieAntwoord = () => new Response(JSON.stringify({ code: "WRONG_REQUEST", message: "Unknown authorization" }), { status: 400 });
let uit = await inwisselen();
check("mislukt: de app krijgt een fout", uit.status >= 400, String(uit.status));
check("en de reden staat erin", /WRONG_REQUEST/.test(uit.fout), uit.fout);
check("met de status erbij", /400/.test(uit.fout), uit.fout);

/* 2b. Precies zijn geval: de code was al gebruikt. */
sessieAntwoord = () => new Response(JSON.stringify({
  code: "ALREADY_AUTHORIZED", message: "Session is already authorized" }), { status: 422 });
uit = await inwisselen();
check("al gebruikte code: leesbare fout", /ALREADY_AUTHORIZED/.test(uit.fout), uit.fout);
check("met de uitleg van Enable Banking", /already authorized/.test(uit.fout), uit.fout);

let heen = "";

/* 3. Enable Banking ligt eruit. */
sessieAntwoord = () => new Response("stuk", { status: 503 });
uit = await inwisselen();
check("dienst eruit: leesbare reden", /niet bereikbaar/.test(uit.fout), uit.fout);

/* 4. De bank zelf stuurt een fout mee. */
r = await klaar(`error=access_denied&state=${encodeURIComponent(laatsteState)}`);
heen = decodeURIComponent(r.headers.get("Location") || "");
check("bank weigert: terug met die reden", r.status === 302 && /access_denied/.test(heen), heen);

/* 5. Je drukt bij de bank op annuleren. */
r = await klaar(`state=${encodeURIComponent(laatsteState)}`);
check("afgebroken: terug naar de app",
  r.status === 302 && r.headers.get("Location") === `${APP}#bank=afgebroken`, r.headers.get("Location"));

/* 6. Maar een terugkomst zonder geldige handtekening sturen we nergens heen. */
r = await klaar("code=abc&state=verzonnen.handtekening");
check("verzonnen terugkomst: geen omleiding", r.status !== 302, String(r.status));
check("en die wordt geweigerd", r.status === 403, String(r.status));

/* 7. Enable Banking zet een getal in `code` en de uitleg in `message`.
      Dat gaf eerder "(400 400)": tweemaal hetzelfde en nergens goed
      voor, terwijl de bruikbare zin werd weggegooid. */
sessieAntwoord = () => new Response(JSON.stringify({
  code: 400, message: "Authorization code has already been used",
}), { status: 400 });
uit = await inwisselen();
check("een getal in `code` wordt niet als naam herhaald", !/400 400/.test(uit.fout), uit.fout);
check("en de uitleg van Enable Banking komt mee", /already been used/.test(uit.fout), uit.fout);

/* 8. Staat er wél een naam, dan hoort die er ook bij. */
sessieAntwoord = () => new Response(JSON.stringify({
  code: "WRONG_REQUEST", message: "Unknown authorization",
}), { status: 400 });
uit = await inwisselen();
check("een echte code blijft staan", /WRONG_REQUEST/.test(uit.fout), uit.fout);
check("met de zin erachter", /Unknown authorization/.test(uit.fout), uit.fout);

/* 9. Een fout die we wél bij naam kennen houdt zijn nette zin. */
sessieAntwoord = () => new Response(JSON.stringify({
  code: "EXPIRED_SESSION", message: "gone",
}), { status: 400 });
uit = await inwisselen();
check("een bekende fout houdt zijn eigen uitleg", /toestemming bij je bank is verlopen/.test(uit.fout), uit.fout);

globalThis.fetch = echteFetch;
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
