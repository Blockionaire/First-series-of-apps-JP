/* =====================================================================
   GELDZAKEN — meer dan één bankrekening volgen
   =====================================================================
   De bankkoppeling was op één rekening gebouwd. Wie er twee uitleest
   kon de tweede nergens kwijt, en alles belandde op dezelfde plek —
   stil, want niets in het scherm verraadde dat er een tweede bestond.

   Nu volg je er zoveel je wil, elk met zijn eigen bestemming in je
   boekhouding. Het ophalen vraagt ze stuk voor stuk op en houdt bij
   waar elke boeking vandaan kwam. Een koppeling van vóór deze versie
   wordt bij het laden de eerste in de lijst, zodat er niets stil
   verdwijnt.

   Draaien:  node test/tweerekeningen.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Twee bankrekeningen uitlezen, elk naar zijn eigen rekening in de
   boekhouding. En een bestaande koppeling van één rekening mag daarbij
   niet verdwijnen. */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const IBAN_A = "NL12RABO0111111111", IBAN_B = "NL34RABO0222222222";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function start() {
  const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
  p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
  await p.route("**/dienst.test/**", r => {
    const u = r.request().url();
    let lijf;
    if (u.endsWith("/rekeningen")) {
      lijf = { rekeningen: [
        { id: "eb-a", iban: IBAN_A, naam: "Betaalrekening" },
        { id: "eb-b", iban: IBAN_B, naam: "Spaarrekening" }], bank: "Rabobank" };
    } else if (u.endsWith("/transacties")) {
      const rek = JSON.parse(r.request().postData()).rekening;
      lijf = { transacties: [{ datum: "2026-11-20", bedrag: 10, soort: "uitgave",
                               omschrijving: "Van " + rek, tegenpartij: "Winkel", ref: "x-" + rek }] };
    } else lijf = { klaar: true, dienst: "v32" };
    r.fulfill({ status: 200, contentType: "application/json",
                headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(lijf) });
  });
  await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  return p;
}

console.log("\n— een oude koppeling met één rekening blijft staan —");
let p = await start();
await p.evaluate(async ({ IBAN_A }) => {
  /* Zoals het er vóór deze versie in de opslag stond. */
  const { dbZet } = await import("./js/db.js");
  await dbZet("apparaat", { id: "bank", adres: "https://dienst.test", woord: "geheim",
    sessie: "s1", bankNaam: "Rabobank", rekening: "eb-a", rekeningNaam: IBAN_A,
    iban: IBAN_A, appRekening: "" });
}, { IBAN_A });
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);
let gevolgd = await p.evaluate(async () => (await import("./js/bank.js")).bank.rekeningen);
check("hij staat nu in de lijst", gevolgd.length === 1 && gevolgd[0].id === "eb-a", JSON.stringify(gevolgd));

console.log("\n— twee rekeningen kiezen —");
p = await start();
await p.evaluate(async ({ IBAN_A, IBAN_B }) => {
  const S = await import("./js/store.js"); const B = await import("./js/bank.js");
  await S.bewaarRekening(S.legeRekening({ naam: "Betaal", iban: IBAN_A, soort: "betaal", standaard: true }));
  await S.bewaarRekening(S.legeRekening({ naam: "Spaar", iban: IBAN_B, soort: "spaar" }));
  Object.assign(B.bank, { adres: "https://dienst.test", woord: "geheim", sessie: "s1", bankNaam: "Rabobank" });
  S.meld();
}, { IBAN_A, IBAN_B });
await p.waitForTimeout(500);

await p.locator("[data-bank-rekening]").click();
await p.waitForTimeout(900);
check("de keuzelijst toont beide", (await p.locator("[data-kies]").count()) === 2);
await p.locator('[data-kies="eb-a"]').click();
await p.locator('[data-kies="eb-b"]').click();
await p.getByText("Klaar", { exact: true }).click();
await p.waitForTimeout(900);

gevolgd = await p.evaluate(async () => (await import("./js/bank.js")).bank.rekeningen);
check("allebei gevolgd", gevolgd.length === 2, JSON.stringify(gevolgd.map(r => r.id)));
check("elk aan zijn eigen rekening geknoopt via de IBAN",
  gevolgd[0].appRekening && gevolgd[1].appRekening && gevolgd[0].appRekening !== gevolgd[1].appRekening,
  JSON.stringify(gevolgd.map(r => r.appRekening)));
check("er staan twee bestemmingen in het kaartje", (await p.locator("[data-bank-doel]").count()) === 2);
check("de kop zegt hoeveel je volgt", /2 gevolgd/.test(await p.locator("#scherm").textContent()));

console.log("\n— ophalen vraagt ze allebei, met herkomst —");
const uit = await p.evaluate(async () => (await import("./js/bank.js")).haalTransacties({ alles: true }));
check("twee boekingen terug", uit.transacties.length === 2, String(uit.transacties.length));
check("elk met zijn eigen herkomst",
  uit.transacties.map(t => t.bron).sort().join(",") === "eb-a,eb-b",
  uit.transacties.map(t => t.bron).join(","));
check("en met de rekening waar hij heen moet",
  uit.transacties.every(t => !!t.appRekening) &&
  uit.transacties[0].appRekening !== uit.transacties[1].appRekening);

console.log("\n— de bestemming omzetten zonder dat het terugspringt —");
const betaalId = await p.evaluate(async () => (await import("./js/store.js")).state.rekeningen.find(r => r.naam === "Betaal").id);
await p.selectOption('[data-bank-doel="eb-b"]', betaalId);
await p.waitForTimeout(700);
check("de keuze staat er nog", (await p.locator('[data-bank-doel="eb-b"]').inputValue()) === betaalId);
check("en is bewaard", await p.evaluate(async () => {
  const B = await import("./js/bank.js");
  return B.bank.rekeningen.find(r => r.id === "eb-b").appRekening;
}) === betaalId);

await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(900);
check("ook na herladen", await p.evaluate(async () => {
  const B = await import("./js/bank.js");
  return B.bank.rekeningen.find(r => r.id === "eb-b")?.appRekening;
}) === betaalId);

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
