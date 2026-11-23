/* =====================================================================
   GELDZAKEN — rood en groen mogen elkaar niet tegenspreken
   =====================================================================
   Een foutmelding bleef staan nadat hij niet meer waar was. Onder een
   groen "De dienst antwoordt" las je dan nog steeds dat de dienst niet
   antwoordde, met een lijst oorzaken die geen van alle klopten. Twee
   dingen tegelijk waarvan er één liegt, en geen manier om te zien
   welke — dat is erger dan geen melding.

   Draaien:  node test/tegenspraak.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Eerst een mislukking, dan een geslaagde test. Blijft de oude klacht
   staan, dan lees je onder een groen vinkje dat de dienst niet
   antwoordt — twee dingen tegelijk waarvan er één liegt. */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));

let bereikbaar = false;
await p.route("**/dienst.test/**", r => bereikbaar
  ? r.fulfill({ status: 200, contentType: "application/json",
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ klaar: true, dienst: "v30" }) })
  : r.abort("failed"));

await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForSelector("#bankadres");
await p.fill("#bankadres", "https://dienst.test");
await p.fill("#bankwoord", "geheim");
await p.waitForTimeout(800);

console.log("\n— eerst gaat het mis —");
await p.locator("[data-bank-proef]").click();
await p.waitForTimeout(1500);
let tekst = await p.locator("#scherm").textContent();
check("er staat een klacht", /antwoordde niet/.test(tekst));

console.log("\n— en daarna lukt het —");
bereikbaar = true;
await p.locator("[data-bank-proef]").click();
await p.waitForTimeout(1500);
tekst = await p.locator("#scherm").textContent();
check("het groene vinkje staat er", /De dienst antwoordt/.test(tekst));
check("de oude klacht is weg", !/antwoordde niet/.test(tekst), tekst.match(/antwoordde niet[^.]*/)?.[0]);
check("geen rode regel meer", await p.locator(".veld__fout").count() === 0);
check("en de versie staat erbij", /v30/.test(tekst));
check("zonder zichzelf te herhalen",
  (tekst.match(/De dienst antwoordt/g) || []).length === 1,
  String((tekst.match(/De dienst antwoordt/g) || []).length));

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
