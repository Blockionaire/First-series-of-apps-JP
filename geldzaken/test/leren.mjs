/* =====================================================================
   GELDZAKEN — leert de app van wat jij indeelt?
   =====================================================================
   Het hele rondje in één proef: een naam die de app niet kent, jij
   deelt hem in, en kijkt hij de volgende keer wel goed. Plus de twee
   dingen die daarbij makkelijk misgaan — een naam met een tussenwoord
   ("Jan de Groot" wordt "jan groot", en dat staat nergens als
   aaneengesloten tekst), en dat een keuze van jou nooit door een
   vermoeden wordt overschreven.

   Draaien:  node test/leren.mjs   (vanuit de map geldzaken, met een
   server op poort 8123)
   ===================================================================== */

/* Het hele rondje: een boeking die niemand kent, zelf indelen, en kijkt
   de app dan de volgende keer wél goed? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
await p.goto("http://127.0.0.1:8123/index.html#/start", { waitUntil: "networkidle" });
await p.waitForTimeout(800);

/* Rechtstreeks met de winkel praten; het gaat hier om de logica. */
const winkel = async (fn, ...args) => p.evaluate(async ({ fn, args }) => {
  const s = await import("./js/store.js");
  return new Function("s", "args", `return (${fn})(s, ...args)`)(s, args);
}, { fn: fn.toString(), args });

console.log("\n— een naam die niemand kent —");
let geraden = await winkel(s => s.raadCategorie("Kapsalon Figaro Amsterdam", "uitgave"));
check("die kent de app nog niet", geraden === "", geraden);

console.log("\n— je deelt hem zelf in —");
await winkel(async (s) => {
  const cat = s.state.categorieen.find(c => (c.soort || "uitgave") === "uitgave");
  await s.bewaarTransactie(s.legeTransactie({
    datum: "2026-11-02", bedrag: 32, soort: "uitgave",
    omschrijving: "Kapsalon Figaro Amsterdam", categorie: cat.id,
  }));
  return cat.id;
});
const regels = await winkel(s => s.state.regels.map(r => r.trefwoord));
check("de app heeft er een regel van gemaakt", regels.includes("kapsalon figaro"), JSON.stringify(regels));

console.log("\n— en de volgende keer? —");
geraden = await winkel(s => s.raadCategorie("Kapsalon Figaro Utrecht pas 003", "uitgave"));
check("nu herkent hij hem, ook met andere tekst erachter", !!geraden, geraden);
const zelfde = await winkel(s => {
  const r = s.state.regels.find(x => x.trefwoord === "kapsalon figaro");
  return s.raadCategorie("Kapsalon Figaro Utrecht pas 003", "uitgave") === r.categorie;
});
check("en onder dezelfde categorie", zelfde);

console.log("\n— de tegenpartij telt mee bij het raden —");
const viaTegenpartij = await winkel(s => s.raadCategorie("BEA NR:A1B2 12.04.26/13.55", "uitgave", "Kapsalon Figaro"));
check("ook als de naam alleen in de tegenpartij staat", !!viaTegenpartij, viaTegenpartij);

console.log("\n— een naam met een tussenwoord —");
await winkel(async (s) => {
  const cat = s.state.categorieen.filter(c => (c.soort||"uitgave") === "uitgave")[2];
  await s.bewaarTransactie(s.legeTransactie({
    datum: "2026-11-05", bedrag: 44, soort: "uitgave",
    omschrijving: "Jan de Groot Tuinen", categorie: cat.id }));
});
const tussen = await winkel(s => s.state.regels.map(r => r.trefwoord));
check("hij leert 'jan groot' (het tussenwoord valt weg)", tussen.includes("jan groot"), JSON.stringify(tussen));
check("en herkent daarmee tóch 'Jan de Groot Tuinen'",
  !!(await winkel(s => s.raadCategorie("Jan de Groot Tuinen", "uitgave"))));
check("ook bij een andere vestiging",
  !!(await winkel(s => s.raadCategorie("JAN DE GROOT TUINEN BREDA", "uitgave"))));
check("maar niet bij iets waar maar een woord van klopt",
  !(await winkel(s => s.raadCategorie("Groot Winkelbedrijf", "uitgave"))));

console.log("\n— met terugwerkende kracht —");
await winkel(async (s) => {
  await s.bewaarVeelTransacties([s.legeTransactie({
    datum: "2026-11-03", bedrag: 21, soort: "uitgave",
    omschrijving: "Kapsalon Figaro Haarlem", categorie: "",
  })]);
});
const teDoen = await winkel(s => s.pasRegelsToe({ alleenTellen: true }));
check("hij ziet er één openstaan", teDoen >= 1, String(teDoen));
const gedaan = await winkel(s => s.pasRegelsToe());
check("en deelt hem alsnog in", gedaan >= 1, String(gedaan));
const nogLeeg = await winkel(s => s.state.transacties.filter(t => t.omschrijving.includes("Haarlem") && !t.categorie).length);
check("die boeking heeft nu een categorie", nogLeeg === 0, String(nogLeeg));

console.log("\n— maar wat jij zelf koos blijft staan —");
const bewaard = await winkel(async (s) => {
  const anders = s.state.categorieen.filter(c => (c.soort || "uitgave") === "uitgave")[1];
  await s.bewaarTransactie(s.legeTransactie({
    datum: "2026-11-04", bedrag: 9, soort: "uitgave",
    omschrijving: "Kapsalon Figaro Delft", categorie: anders.id,
  }));
  await s.pasRegelsToe();
  const t = s.state.transacties.find(x => x.omschrijving.includes("Delft"));
  return t.categorie === anders.id;
});
check("een eigen keuze wordt niet overschreven", bewaard);

console.log("\n— en het scherm laat het zien —");
await p.goto("http://127.0.0.1:8123/index.html#/regels", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const scherm = await p.locator("#scherm").textContent();
check("de geleerde regel staat op het scherm", /kapsalon figaro/.test(scherm), scherm.slice(0, 160));
check("er is een keuzelijst om hem bij te sturen", await p.locator("[data-regel-categorie]").count() > 0);
check("en een knop om hem weg te halen", await p.locator("[data-wis-regel]").count() > 0);
check("de ingang staat in de instellingen", await (async () => {
  await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  return await p.locator('a[href="#/regels"]').count() === 1;
})());

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
