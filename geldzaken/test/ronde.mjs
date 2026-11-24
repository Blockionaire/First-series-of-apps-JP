/* =====================================================================
   GELDZAKEN — de afhandeling moet bij het levende scherm horen
   =====================================================================
   Niet hertekenen terwijl er een vinger op het scherm staat was de
   goede gedachte, maar het loslaten zat een stap te vroeg: een klik
   komt ná `pointerup`. De hertekening viel dus precies in het gaatje
   ertussen, en de klik werd bezorgd bij een scherm dat niet meer in de
   pagina stond. In het spoor was dat te zien als "dit is ronde 3,
   levend is ronde 4".

   Nu wachten we tot de klik is afgehandeld. En komt er geen klik —
   omdat je scrolde of naast de knop losliet — dan gebeurt het alsnog,
   want een app die blijft wachten is erger dan een late hertekening.

   Draaien:  node test/ronde.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Een klik komt ná het loslaten van de vinger. Tekenden we al bij het
   loslaten, dan werd de klik bezorgd bij een scherm dat niet meer in de
   pagina stond — zijn "LET OP: dit is ronde 3, levend is ronde 4". */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForSelector("[data-modus]");

/* Een hertekening die binnenkomt terwijl je vinger op het scherm staat
   — zoals de boodschappenkoppeling doet bij het openen. */
await p.evaluate(async () => {
  const S = await import("./js/store.js");
  document.addEventListener("pointerdown", () => S.meld(), true);
});

await p.evaluate(async () => (await import("./js/util.js")).spoorLeeg());
await p.locator('[data-modus="volledig"] .soortkeuze__uitleg').click();
await p.waitForTimeout(900);

const spoor = await p.evaluate(async () => (await import("./js/util.js")).spoorTekst());
console.log("\n— met een hertekening midden in de tik —");
check("de afhandeling hoort bij het levende scherm", !/LET OP/.test(spoor),
  spoor.split("\n").filter(r => /LET OP/.test(r)).join(" | "));
check("de knop is herkend", /→ data-modus/.test(spoor), spoor.split("\n").slice(-5).join(" | "));
check("en de modus is gewisseld",
  (await p.evaluate(async () => (await import("./js/store.js")).state.instellingen.modus)) === "volledig");
check("precies één keer", (spoor.match(/modus wisselen naar/g) || []).length === 1,
  String((spoor.match(/modus wisselen naar/g) || []).length));

console.log("\n— en de uitgestelde hertekening gebeurt alsnog —");
await p.waitForTimeout(600);
check("het scherm is bijgewerkt", /Boekingen/.test(await p.locator("nav, .tabbalk").first().textContent()));

console.log("\n— scrollen zonder klik blijft de app niet ophouden —");
await p.evaluate(async () => {
  const S = await import("./js/store.js");
  const el = document.querySelector("#scherm");
  const o = { bubbles: true, cancelable: true, clientX: 100, clientY: 400, pointerId: 7 };
  el.dispatchEvent(new PointerEvent("pointerdown", o));
  S.meld();                                  /* hertekening wil gebeuren */
  el.dispatchEvent(new PointerEvent("pointerup", o));   /* geen klik erna */
});
await p.waitForTimeout(900);
check("hij tekent toch, ook zonder klik",
  await p.evaluate(() => !!document.querySelector("#scherm")));

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
