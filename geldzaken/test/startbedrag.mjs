/* =====================================================================
   GELDZAKEN — wat er bij de start al in zat
   =====================================================================
   Elk potje begon op nul. Wie de app in gebruik neemt heeft echter al
   geld staan, en dan lopen je potjes samen altijd achter op je echte
   saldo — ook als je verder alles netjes bijhoudt. Met een beginbedrag
   sluiten ze er vanaf dag één op aan.

   Alleen bij een spaarpotje van betekenis: een vrij potje en een vaste
   last gaan per maand, en daar zou de vraag een antwoord opleveren dat
   niets doet.

   Draaien:  node test/startbedrag.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Een potje dat op nul begint loopt altijd achter op je echte saldo.
   Telt het beginbedrag mee, en alleen waar het betekenis heeft? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
await p.goto("http://127.0.0.1:8123/index.html#/potjes", { waitUntil: "networkidle" });
await p.waitForTimeout(800);

const rekenen = (velden, maand) => p.evaluate(async ({ velden, maand }) => {
  const S = await import("./js/store.js");
  const B = await import("./js/bereken.js");
  const potje = S.legPotje(velden);
  return B.potSaldo(S.state, potje, maand);
}, { velden, maand });

console.log("\n— een spaarpotje —");
let s = await rekenen({ soort: "sparen", maandelijks: 50, startMaand: "2026-10" }, "2026-12");
check("zonder beginbedrag: drie maanden à 50", s.saldo === 150, String(s.saldo));

s = await rekenen({ soort: "sparen", maandelijks: 50, startMaand: "2026-10", startBedrag: 1200 }, "2026-12");
check("met 1200 erbij", s.saldo === 1350, String(s.saldo));
check("en het staat apart vermeld", s.startBedrag === 1200, String(s.startBedrag));
check("het automatische deel blijft wat het was", s.automatisch === 150, String(s.automatisch));

console.log("\n— maar niet waar het niets betekent —");
s = await rekenen({ soort: "vrij", maandelijks: 100, startBedrag: 999 }, "2026-12");
check("een vrij potje gaat per maand, dus geen beginbedrag", s.saldo === 100, String(s.saldo));
s = await rekenen({ soort: "vast", maandelijks: 100, startBedrag: 999 }, "2026-12");
check("een vaste last ook niet", s.saldo === 0, String(s.saldo));

console.log("\n— rommel in het veld breekt niets —");
s = await rekenen({ soort: "sparen", maandelijks: 0, startMaand: "2026-12", startBedrag: "geen getal" }, "2026-12");
check("onleesbaar wordt nul", s.saldo === 0, String(s.saldo));

console.log("\n— en in het scherm —");
await p.evaluate(async () => {
  const S = await import("./js/store.js");
  await S.bewaarPotje(S.legPotje({
    naam: "Buffer", soort: "sparen", maandelijks: 25, startBedrag: 800, startMaand: "2026-11",
  }));
  S.meld();
});
await p.waitForTimeout(700);
const lijst = await p.locator("#scherm").textContent();
check("het potje telt het beginbedrag mee", /850|825/.test(lijst), lijst.slice(0, 200));

const pot = await p.evaluate(async () => (await import("./js/store.js")).state.potjes.find(x => x.naam === "Buffer").id);
await p.goto(`http://127.0.0.1:8123/index.html#/potjes/${pot}`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const detail = await p.locator("#scherm").textContent();
check("het detail noemt wat er al in zat", /Zat er al in/.test(detail), detail.slice(0, 250));

console.log("\n— het veld verschijnt alleen bij een spaarpotje —");
await p.locator("[data-bewerk-potje]").first().click();
await p.waitForTimeout(500);
check("bij sparen staat het er", !(await p.locator("[data-startbedrag]").isHidden()));
await p.locator('[data-soort="vrij"]').click();
await p.waitForTimeout(300);
check("bij een vrij potje verdwijnt het", await p.locator("[data-startbedrag]").isHidden());
await p.locator('[data-soort="sparen"]').click();
await p.waitForTimeout(300);
check("en het komt terug", !(await p.locator("[data-startbedrag]").isHidden()));

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
