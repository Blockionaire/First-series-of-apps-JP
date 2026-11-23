/* =====================================================================
   GELDZAKEN — een sessie overdragen naar je beginscherm
   =====================================================================
   Op iOS heeft een app op je beginscherm een eigen opslag, los van
   Safari. Koppel je je bank vanuit die app, dan stuurt je bank je
   browser terug — en komt de sessie dus aan op de plek waar het adres
   en het woord níét staan. Dat is geen randgeval maar wat er normaal
   gebeurt.

   Deze proef zet twee gescheiden browsers naast elkaar, precies zoals
   Safari en je beginscherm zich verhouden, en loopt de hele overdracht
   na.

   Draaien:  node test/overdracht.mjs   (vanuit de map geldzaken, met
   een server op poort 8123)
   ===================================================================== */

/* Zijn geval: je koppelt vanuit de app op je beginscherm, je bank stuurt
   je browser terug, en daar staat geen adres en woord. Komt die sessie
   dan alsnog op de goede plek? */
/* Zijn geval: je koppelt vanuit de app op je beginscherm, je bank stuurt
   je browser terug, en daar staat geen adres en woord. Komt die sessie
   dan alsnog op de goede plek? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const opties = { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true };

/* Twee aparte browsers: dat is precies wat Safari en een app op je
   beginscherm zijn — zelfde adres, gescheiden opslag. */
const safari = await (await browser.newContext(opties)).newPage();
const beginscherm = await (await browser.newContext(opties)).newPage();
for (const p of [safari, beginscherm]) {
  p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
  await p.route("**/dienst.test/**", r => {
    const lijf = r.request().url().endsWith("/sessie")
      ? { sessie: "sessie-abc123" }
      : { rekeningen: [{ id: "rek-1", iban: "NL00TEST0123456789", naam: "Betaalrekening" }],
          bank: "Rabobank", geldigTot: "2027-05-01" };
    r.fulfill({ status: 200, contentType: "application/json",
                headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(lijf) });
  });
}

console.log("\n— in de app op je beginscherm staan adres en woord —");
await beginscherm.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await beginscherm.waitForSelector("#bankadres");
await beginscherm.fill("#bankadres", "https://dienst.test");
await beginscherm.fill("#bankwoord", "zeergeheim");
await beginscherm.waitForTimeout(900);
check("die staan er", (await beginscherm.inputValue("#bankwoord")) === "zeergeheim");

console.log("\n— maar je bank stuurt Safari terug, zonder die gegevens —");
await safari.goto("http://127.0.0.1:8123/index.html#bankcode=code-xyz789", { waitUntil: "networkidle" });
await safari.waitForTimeout(1200);
const safariTekst = await safari.locator("#scherm").textContent();
check("Safari klaagt niet meer dat het woord mist", !/Vul eerst het adres/.test(safariTekst));
check("maar zegt dat het koppelen gelukt is", /koppelen is gelukt/i.test(safariTekst), safariTekst.slice(0, 200));
check("en laat de code zien", /code-xyz789/.test(await safari.locator("[data-overdracht]").textContent()));
check("met een knop om te kopiëren", await safari.locator("[data-code-kopieer]").count() === 1);

console.log("\n— de code overleeft een herlaad —");
await safari.reload({ waitUntil: "networkidle" });
await safari.waitForTimeout(1000);
check("hij staat er na herladen nog",
  /code-xyz789/.test(await safari.locator("#scherm").textContent()));

console.log("\n— en weggooien is echt weg —");
await safari.evaluate(async () => {
  const B = await import("./js/bank.js");
  await B.zetInstellingen({ overdracht: "" });
});
await safari.reload({ waitUntil: "networkidle" });
await safari.waitForTimeout(1000);
check("na weggooien en herladen is hij verdwenen",
  !/code-xyz789/.test(await safari.locator("#scherm").textContent()));

console.log("\n— die code neem je over op je beginscherm —");
await beginscherm.locator("[data-code-plak]").click();
await beginscherm.waitForTimeout(400);
await beginscherm.fill("#overcode", "c:code-xyz789");
await beginscherm.getByText("Overnemen", { exact: true }).click();
await beginscherm.waitForTimeout(1200);

const na = await beginscherm.locator("#scherm").textContent();
check("nu staat hij gekoppeld", /Gekoppeld met/.test(na), na.slice(0, 300));
check("met de naam van je bank", /Rabobank/.test(na));
check("en de rekening is vast gekozen", /NL00TEST0123456789/.test(na));

const bewaard = await beginscherm.evaluate(() => new Promise(k => {
  const v = indexedDB.open("geldzaken");
  v.onsuccess = () => {
    const r = v.result.transaction("apparaat").objectStore("apparaat").get("bank");
    r.onsuccess = () => k(r.result || null);
  };
}));
check("de sessie is bewaard", bewaard?.sessie === "sessie-abc123", JSON.stringify(bewaard?.sessie));

console.log("\n— en een verzonnen code komt er niet in —");
await beginscherm.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await beginscherm.waitForTimeout(700);
const uitslag = await beginscherm.evaluate(async () => {
  const B = await import("./js/bank.js");
  try { await B.neemOver("niet goed hoor!"); return "toegelaten"; }
  catch (e) { return e.message; }
});
check("een code met spaties wordt geweigerd", /geen geldige code/.test(uitslag), uitslag);

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
