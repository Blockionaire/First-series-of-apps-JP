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

console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
