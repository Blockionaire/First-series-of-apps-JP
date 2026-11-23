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

/* 1. Het gewone geval. */
let r = await klaar(`code=abc&state=${encodeURIComponent(laatsteState)}`);
check("gelukt: terug naar de app met de sessie",
  r.status === 302 && r.headers.get("Location") === `${APP}#bank=sess-123`, r.headers.get("Location"));

/* 2. Enable Banking weigert de code — zijn geval van zojuist. */
sessieAntwoord = () => new Response(JSON.stringify({ code: "WRONG_REQUEST" }), { status: 400 });
r = await klaar(`code=abc&state=${encodeURIComponent(laatsteState)}`);
let heen = r.headers.get("Location") || "";
check("mislukt: tóch terug naar de app", r.status === 302 && heen.startsWith(APP), heen);
check("en de reden staat erin", /WRONG_REQUEST/.test(decodeURIComponent(heen)), heen);
check("met de status erbij", /400/.test(decodeURIComponent(heen)), heen);

/* 3. Enable Banking ligt eruit. */
sessieAntwoord = () => new Response("stuk", { status: 503 });
r = await klaar(`code=abc&state=${encodeURIComponent(laatsteState)}`);
heen = decodeURIComponent(r.headers.get("Location") || "");
check("dienst eruit: terug met een leesbare reden",
  r.status === 302 && /niet bereikbaar/.test(heen), heen);

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

globalThis.fetch = echteFetch;
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
