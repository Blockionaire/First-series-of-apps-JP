/* =====================================================================
   GELDZAKEN — niet hertekenen terwijl er een vinger op het scherm staat
   =====================================================================
   Een klik ontstaat pas als indrukken én loslaten op hetzelfde element
   gebeuren. Hertekent de app daartussenin, dan is dat element weg en
   komt er geen klik — de knop lijkt stuk. Dat is hier herhaaldelijk
   gebeurd, en het was nooit de knop: de boodschappenkoppeling haalt bij
   het openen haar gegevens op, en dat antwoord landt een seconde of
   twee later. Precies wanneer je aan het tikken bent.

   Wachten kost niets. Een hertekening een halve tel uitstellen ziet
   niemand; een tik die nergens aankomt wel.

   Draaien:  node test/vingerneer.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Hertekent de app terwijl je vinger op het scherm staat, dan verdwijnt
   de knop onder je vinger en komt er geen klik. Dat is wat "Alles
   bijhouden" stil hield. Wacht hij nu? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForSelector("[data-modus]");

console.log("\n— een hertekening midden in een tik —");
const uitslag = await p.evaluate(async () => {
  const S = await import("./js/store.js");
  const knop = [...document.querySelectorAll("[data-modus]")].find(k => k.dataset.modus === "volledig");
  const r = knop.getBoundingClientRect();
  const opties = { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, pointerId: 1 };

  knop.dispatchEvent(new PointerEvent("pointerdown", opties));
  document.dispatchEvent(new PointerEvent("pointerdown", { ...opties, bubbles: true }));

  /* Dit is wat de boodschappenkoppeling doet zodra haar gegevens
     binnen zijn: het hele scherm opnieuw tekenen. */
  S.meld();
  await new Promise(k => setTimeout(k, 50));

  const nogSteeds = document.body.contains(knop);
  document.dispatchEvent(new PointerEvent("pointerup", { ...opties, bubbles: true }));
  return { nogSteeds };
});
check("de knop staat er nog na de hertekening", uitslag.nogSteeds);

await p.waitForTimeout(400);
check("en de hertekening is daarna alsnog gebeurd",
  await p.evaluate(() => !!document.querySelector("#scherm")));

console.log("\n— en de knop doet het gewoon —");
await p.locator('[data-modus="volledig"]').click();
await p.waitForTimeout(900);
const modus = await p.evaluate(async () => (await import("./js/store.js")).state.instellingen.modus);
check("de modus staat op volledig", modus === "volledig", String(modus));
check("en je bent naar het startscherm gestuurd", /#\/start/.test(p.url()), p.url());
check("met de Boekingen-tab erbij",
  /Boekingen/.test(await p.locator(".tabbalk, nav").first().textContent()));

console.log("\n— en weer terug —");
await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.locator('[data-modus="eenvoudig"]').click();
await p.waitForTimeout(900);
check("terug op hoofdlijnen",
  (await p.evaluate(async () => (await import("./js/store.js")).state.instellingen.modus)) === "eenvoudig");

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
