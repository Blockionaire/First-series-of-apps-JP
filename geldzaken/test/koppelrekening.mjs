/* =====================================================================
   GELDZAKEN — je bankrekening aan een rekening in de app knopen
   =====================================================================
   De app kende de IBAN van je gekoppelde rekening, en een rekening in
   je boekhouding heeft datzelfde veld — maar niemand legde het verband.
   Alles wat je inlas belandde op je standaardrekening, ook als het
   ergens anders vandaan kwam.

   Nu knoopt hij ze vanzelf aan elkaar als de IBAN al bekend is, biedt
   hij aan er een rekening van te maken als dat niet zo is, en kun je
   het altijd omzetten. Spaties en hoofdletters in een IBAN doen er
   daarbij niet toe.

   Draaien:  node test/koppelrekening.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Een ingelezen bankrekening hoort aan een rekening in je boekhouding
   vast te zitten — vanzelf als de IBAN al bekend is, en anders met twee
   tikken. En aan te passen. */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const IBAN = "NL12RABO0123456789";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function opzet({ metRekening }) {
  const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
  p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
  await p.route("**/dienst.test/**", r => {
    const u = r.request().url();
    const lijf = u.endsWith("/rekeningen")
      ? { rekeningen: [{ id: "eb-1", iban: IBAN, naam: "Betaalrekening" }], bank: "Rabobank" }
      : { klaar: true, dienst: "v32" };
    r.fulfill({ status: 200, contentType: "application/json",
                headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(lijf) });
  });
  await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);

  await p.evaluate(async ({ metRekening, IBAN }) => {
    const S = await import("./js/store.js");
    const B = await import("./js/bank.js");
    if (metRekening) {
      await S.bewaarRekening(S.legeRekening({ naam: "Mijn betaalrekening", iban: IBAN, soort: "betaal" }));
    }
    await S.bewaarRekening(S.legeRekening({ naam: "Spaarpot", iban: "NL99INGB0000000000", soort: "spaar", standaard: true }));
    Object.assign(B.bank, { adres: "https://dienst.test", woord: "geheim", sessie: "s1", bankNaam: "Rabobank" });
    await B.kiesRekening("eb-1", IBAN, IBAN);
    S.meld();
  }, { metRekening, IBAN });
  await p.waitForTimeout(600);
  return p;
}

const gekoppeldAan = p => p.evaluate(async () => {
  const B = await import("./js/bank.js");
  return B.boekOpRekening()?.naam || null;
});

console.log("\n— de IBAN staat al in je boekhouding —");
let p = await opzet({ metRekening: true });
check("hij knoopt ze vanzelf aan elkaar", (await gekoppeldAan(p)) === "Mijn betaalrekening", await gekoppeldAan(p));
check("de keuze staat in het kaartje", await p.locator("#bankdoel").count() === 1);
check("en zegt dat hij hem herkende",
  /staat ook in je boekhouding/.test(await p.locator("#scherm").textContent()));
check("geen aanmaakknop nodig", await p.locator("[data-bank-nieuwe-rekening]").count() === 0);

console.log("\n— en je kunt het omzetten —");
const spaar = await p.evaluate(async () =>
  (await import("./js/store.js")).state.rekeningen.find(r => r.naam === "Spaarpot").id);
await p.selectOption("#bankdoel", spaar);
await p.waitForTimeout(700);
check("nu gaat het naar de spaarpot", (await gekoppeldAan(p)) === "Spaarpot", await gekoppeldAan(p));
check("dat is bewaard", await p.evaluate(() => new Promise(k => {
  const v = indexedDB.open("geldzaken");
  v.onsuccess = () => {
    const r = v.result.transaction("apparaat").objectStore("apparaat").get("bank");
    r.onsuccess = () => k(!!r.result?.appRekening);
  };
})));

console.log("\n— het inlezen gebruikt die koppeling —");
await p.goto("http://127.0.0.1:8123/index.html#/importeren", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const gekozen = await p.locator("#ibank").inputValue();
const spaarId = spaar;
check("de gekoppelde rekening staat voorgekozen", gekozen === spaarId, `${gekozen} vs ${spaarId}`);

console.log("\n— en als die IBAN nog nergens staat —");
p = await opzet({ metRekening: false });
check("hij kiest niet zomaar iets", (await gekoppeldAan(p)) === "Spaarpot", await gekoppeldAan(p));
check("maar biedt aan hem aan te maken", await p.locator("[data-bank-nieuwe-rekening]").count() === 1);
check("met de IBAN erin", /NL12RABO0123456789/.test(await p.locator("[data-bank-nieuwe-rekening]").textContent()));

await p.locator("[data-bank-nieuwe-rekening]").click();
await p.waitForTimeout(900);
check("de rekening is aangemaakt", (await gekoppeldAan(p)) === "Rabobank", await gekoppeldAan(p));
const nieuw = await p.evaluate(async () => (await import("./js/store.js")).state.rekeningen.find(r => r.naam === "Rabobank"));
check("met de juiste IBAN", nieuw?.iban === IBAN, nieuw?.iban);
check("en de aanmaakknop is weg", await p.locator("[data-bank-nieuwe-rekening]").count() === 0);

console.log("\n— spaties en kleine letters maken niet uit —");
const zelfde = await p.evaluate(async () => {
  const B = await import("./js/bank.js");
  return !!B.rekeningMetIban("nl12 rabo 0123 4567 89");
});
check("dezelfde IBAN anders geschreven wordt herkend", zelfde);

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
