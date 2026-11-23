/* =====================================================================
   GELDZAKEN — proef op het afgesproken woord
   =====================================================================
   De dienst in ../bank/worker.js laat niemand binnen zonder het woord.
   Dat is precies de bedoeling, maar het maakt één fout bijzonder duur:
   een secret wordt geplakt, en daar sluipt zo een spatie of een
   regeleinde achteraan. Het woord ziet er dan goed uit en klopt toch
   nooit, en de dienst zegt alleen "verkeerd woord" — wat je op het
   verkeerde spoor zet, want je ziet het verschil niet.

   Vandaar deze proef: wat eromheen staat telt niet mee, wat erin staat
   wel.

   Draaien:  node test/woord.mjs   (vanuit de map geldzaken)
   ===================================================================== */

import worker from "../bank/worker.js";

const HERKOMST = "https://blockionaire.github.io";

const omgeving = woord => ({
  EB_APP_ID: "proef", EB_SLEUTEL: "proef",
  GELDZAKEN_WOORD: woord, HERKOMST,
});

/* Vraagt /status op — het enige pad dat niets anders doet dan kijken of
   je binnen mag. */
async function proef(geheim, gegeven) {
  const antwoord = await worker.fetch(
    new Request("https://dienst.test/status", {
      headers: { Origin: HERKOMST, Authorization: `Bearer ${gegeven}` },
    }),
    omgeving(geheim),
  );
  return antwoord.status;
}

let goed = 0, mis = 0;
async function check(naam, geheim, gegeven, verwacht) {
  const status = await proef(geheim, gegeven);
  if (status === verwacht) { goed++; console.log(`  ok   ${naam}`); }
  else { mis++; console.log(`  MIS  ${naam} — kreeg ${status}, verwachtte ${verwacht}`); }
}

console.log("\nWat eromheen staat telt niet mee:");
await check("het woord klopt gewoon", "appelmoes", "appelmoes", 200);
await check("regeleinde achter het secret", "appelmoes\n", "appelmoes", 200);
await check("spatie achter het secret", "appelmoes ", "appelmoes", 200);
await check("spaties aan beide kanten", "  appelmoes  ", "appelmoes", 200);
await check("en ook aan de kant van de app", "appelmoes", "  appelmoes\n", 200);

console.log("\nWat erin staat telt wél mee:");
await check("een ander woord komt er niet in", "appelmoes", "perenmoes", 401);
await check("een woord mét spatie blijft gelden", "appel moes", "appel moes", 200);
await check("maar die spatie binnenin telt mee", "appel moes", "appelmoes", 401);
await check("hoofdletters tellen mee", "Appelmoes", "appelmoes", 401);
await check("leeg woord wordt geweigerd", "appelmoes", "", 401);

/* ---------------------------------------------------------------
   En: komt een fout in de instellingen wél bij de app aan?
   ---------------------------------------------------------------
   Zonder de juiste kopteksten houdt de browser het antwoord tegen en
   ziet de app geen melding maar stilte — waarna hij je naar het adres
   en HERKOMST stuurt terwijl daar niets mis mee is. Dat heeft een
   middag gekost, dus het staat hier vast. */
console.log("\nEen fout in de instellingen is leesbaar voor de app:");

async function vraag(omg, methode = "GET") {
  return worker.fetch(new Request("https://dienst.test/status", {
    method: methode,
    headers: { Origin: HERKOMST, Authorization: "Bearer appelmoes" },
  }), omg);
}

const kaal = { EB_APP_ID: "proef", EB_SLEUTEL: "proef", GELDZAKEN_WOORD: "appelmoes", HERKOMST };

for (const weg of ["GELDZAKEN_WOORD", "EB_SLEUTEL", "EB_APP_ID", "HERKOMST"]) {
  const omg = { ...kaal };
  delete omg[weg];

  const r = await vraag(omg);
  const lijf = await r.json();
  const mocht = r.headers.get("Access-Control-Allow-Origin");
  const zegtHet = String(lijf.fout || "").includes(weg);

  if (mocht && zegtHet) { goed++; console.log(`  ok   zonder ${weg} — "${lijf.fout}"`); }
  else { mis++; console.log(`  MIS  zonder ${weg} — koptekst ${mocht || "ontbreekt"}, fout "${lijf.fout}"`); }

  /* En de voorvraag mag het echte verzoek niet al tegenhouden. */
  const v = await vraag(omg, "OPTIONS");
  if (v.headers.get("Access-Control-Allow-Origin")) { goed++; console.log(`  ok   voorvraag komt er zonder ${weg} doorheen`); }
  else { mis++; console.log(`  MIS  voorvraag geblokkeerd zonder ${weg}`); }
}

/* ---------------------------------------------------------------
   De herkomst
   ---------------------------------------------------------------
   Een hostnaam kent geen hoofdletters, en een GitHub-naam vaak wel.
   Hier staat vast dat dat verschil niets uitmaakt — en dat een
   weigering leesbaar terugkomt in plaats van als stilte. */
console.log("\nDe herkomst:");

async function vanaf(origin, herkomstInstelling = HERKOMST) {
  return worker.fetch(new Request("https://dienst.test/status", {
    headers: { Origin: origin, Authorization: "Bearer appelmoes" },
  }), { ...kaal, HERKOMST: herkomstInstelling });
}

async function herkomstCheck(naam, origin, instelling, binnen) {
  const r = await vanaf(origin, instelling);
  const ok = binnen ? r.status === 200 : r.status === 403;
  if (ok) { goed++; console.log(`  ok   ${naam}`); }
  else { mis++; console.log(`  MIS  ${naam} — kreeg ${r.status}`); }
}

await herkomstCheck("gewoon gelijk", HERKOMST, HERKOMST, true);
await herkomstCheck("hoofdletters in de instelling",
  "https://blockionaire.github.io", "https://Blockionaire.github.io", true);
await herkomstCheck("schuine streep aan het eind",
  "https://blockionaire.github.io", "https://blockionaire.github.io/", true);
await herkomstCheck("spaties rond een van meerdere",
  "https://blockionaire.github.io", "https://ergens.test ,  https://Blockionaire.GitHub.io ", true);
await herkomstCheck("een vreemde plek blijft buiten",
  "https://kwaadwillend.test", HERKOMST, false);

console.log("\nEn een weigering is leesbaar in plaats van stil:");
const vreemd = await vanaf("https://kwaadwillend.test");
const lees = vreemd.headers.get("Access-Control-Allow-Origin");
const zin = (await vreemd.json()).fout || "";
if (vreemd.status === 403 && lees === "https://kwaadwillend.test" && zin.includes("HERKOMST")) {
  goed++; console.log(`  ok   de app kan de weigering lezen — "${zin}"`);
} else {
  mis++; console.log(`  MIS  weigering: ${vreemd.status}, koptekst ${lees}, "${zin}"`);
}

/* Maar lezen is geen binnenkomen: geen enkel pad mag open staan. */
for (const pad of ["/banken", "/koppel", "/transacties", "/rekeningen", "/vraag"]) {
  const r = await worker.fetch(new Request(`https://dienst.test${pad}`, {
    method: pad === "/banken" ? "GET" : "POST",
    headers: { Origin: "https://kwaadwillend.test", Authorization: "Bearer appelmoes" },
  }), kaal);
  if (r.status === 403) { goed++; console.log(`  ok   ${pad} blijft dicht voor een vreemde plek`); }
  else { mis++; console.log(`  MIS  ${pad} gaf ${r.status} aan een vreemde plek`); }
}

console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
