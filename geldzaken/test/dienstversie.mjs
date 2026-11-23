/* =====================================================================
   GELDZAKEN — loopt je eigen dienst achter?
   =====================================================================
   De dienst in bank/worker.js zet je met de hand neer bij Cloudflare,
   dus hij kan achterlopen op de app zonder dat iets dat verraadt. Dan
   mist hij reparaties die hier allang zijn gedaan, en zoek je de fout
   op de verkeerde plek — dat is in de praktijk een paar keer gebeurd.

   Hij noemt daarom zijn versie, en de app zegt het als die te oud is.
   Zonder loos alarm: een dienst die zijn versie helemaal niet noemt is
   oud, maar daar klagen we niet over — dat zou elke bestaande opstelling
   meteen laten knipperen.

   Draaien:  node test/dienstversie.mjs   (met een server op poort 8123)
   ===================================================================== */

import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/* Welke versie de app eist staat in de app zelf. Hier een getal
   neerzetten betekent dat deze proef gaat liegen zodra die eis
   opschuift. */
const eis = await (async () => {
  const p = await (await browser.newContext()).newPage();
  await p.goto("http://127.0.0.1:8123/index.html", { waitUntil: "networkidle" });
  const n = await p.evaluate(async () => (await import("./js/bank.js")).DIENST_NODIG);
  await p.context().close();
  return n;
})();
const NU = `v${eis}`, OUD = `v${eis - 7}`;
console.log(`De app verwacht ${NU} of nieuwer.`);

async function proef(antwoord) {
  const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
  p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
  await p.route("**/dienst.test/**", r => r.fulfill({
    status: 200, contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(antwoord),
  }));
  await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
  await p.waitForSelector("#bankadres");
  await p.fill("#bankadres", "https://dienst.test");
  await p.fill("#bankwoord", "geheim");
  await p.waitForTimeout(800);
  await p.locator("[data-bank-proef]").click();
  await p.waitForTimeout(1200);
  return p;
}

console.log("\n— een dienst van nu —");
let p = await proef({ klaar: true, dienst: NU });
let tekst = await p.locator("#scherm").textContent();
check("de test slaagt", /De dienst antwoordt/.test(tekst));
check("en noemt de versie", tekst.includes(NU), tekst.match(/De dienst antwoordt[^.]*/)?.[0]);
check("geen waarschuwing", !/loopt achter/.test(tekst));

console.log("\n— een dienst die achterloopt —");
p = await proef({ klaar: true, dienst: OUD });
tekst = await p.locator("#scherm").textContent();
check("de test slaagt nog steeds", /De dienst antwoordt/.test(tekst));
check("maar er staat een waarschuwing", /loopt achter/.test(tekst));
check("met wat hij draait", tekst.includes(OUD));
check("en wat er nodig is", tekst.includes(`${NU} of nieuwer`));
check("en welk bestand", /worker\.js/.test(tekst));

console.log("\n— een oude dienst die zijn versie niet noemt —");
p = await proef({ klaar: true });
tekst = await p.locator("#scherm").textContent();
check("de test slaagt", /De dienst antwoordt/.test(tekst));
check("maar verzint er geen", !/Hij draait/.test(tekst));
check("en geen loze waarschuwing", !/loopt achter/.test(tekst));

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
