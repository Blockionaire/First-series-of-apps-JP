/* =====================================================================
   GELDZAKEN — van modus wisselen
   =====================================================================
   "Alles bijhouden" bleef stil terwijl de klik aantoonbaar aankwam —
   het spoor toonde "klik op button data-modus" en daarna niets. Zijn
   tik landde op de uitlegtekst ín de knop, dus die proef staat hier
   voorop.

   En een fout tijdens het tekenen verdween in console.error. Op een
   telefoon is er geen console: het scherm blijft dan staan zoals het
   stond en élke knop lijkt stuk, zonder dat iets verraadt waarom.

   Draaien:  node test/modus.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Zijn tik landde op de uitlegtekst ín de knop, niet op de knop zelf.
   Werkt het dan ook, en zegt het spoor wat er herkend wordt? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForSelector("[data-modus]");

const modusNu = () => p.evaluate(async () => (await import("./js/store.js")).state.instellingen.modus || "eenvoudig");

console.log("\n— tikken op de uitlegtekst binnen de knop —");
check("we beginnen op hoofdlijnen", (await modusNu()) === "eenvoudig");
await p.locator('[data-modus="volledig"] .soortkeuze__uitleg').click();
await p.waitForTimeout(900);
check("de modus staat op volledig", (await modusNu()) === "volledig", await modusNu());
check("je bent naar het startscherm gestuurd", /#\/start/.test(p.url()), p.url());

console.log("\n— en op de titel —");
await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.locator('[data-modus="eenvoudig"] .soortkeuze__titel').click();
await p.waitForTimeout(900);
check("terug op hoofdlijnen", (await modusNu()) === "eenvoudig", await modusNu());

console.log("\n— en op het icoontje —");
await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.locator('[data-modus="volledig"] .soortkeuze__icoon').click();
await p.waitForTimeout(900);
check("ook dan wisselt hij", (await modusNu()) === "volledig", await modusNu());

console.log("\n— het spoor zegt wat er herkend is —");
await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
/* Schoon beginnen: het spoor loopt door over de eerdere wisselingen. */
await p.evaluate(async () => (await import("./js/util.js")).spoorLeeg());
await p.locator('[data-modus="eenvoudig"] .soortkeuze__uitleg').click();
await p.waitForTimeout(900);
const spoor = await p.evaluate(async () => (await import("./js/util.js")).spoorTekst());
check("het noemt de herkende knop", /→ data-modus/.test(spoor), spoor.split("\n").slice(-6).join(" | "));
check("en dat het wisselen begon", /modus wisselen naar eenvoudig/.test(spoor));
check("en waar het uitkwam", /modus is nu eenvoudig/.test(spoor));
check("precies één keer gewisseld",
  (spoor.match(/modus wisselen naar/g) || []).length === 1,
  String((spoor.match(/modus wisselen naar/g) || []).length));

console.log("\n— een fout bij het tekenen verdwijnt niet meer in het niets —");
const gezien = await p.evaluate(async () => {
  const S = await import("./js/store.js");
  const stop = S.abonneer(() => { throw new Error("proefbreuk"); });
  S.meld();
  await new Promise(k => setTimeout(k, 120));
  stop();
  const U = await import("./js/util.js");
  return U.spoorTekst();
});
check("het staat in het spoor", /tekenen brak af: proefbreuk/.test(gezien), gezien.split("\n").slice(-3).join(" | "));
check("en er kwam een melding", await p.locator(".melding--fout").count() > 0);

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
