/* =====================================================================
   GELDZAKEN — welke rekening volg je?
   =====================================================================
   "Andere rekening" deed een verzoek aan je bank en liet ondertussen
   niets zien. Een knop die een tel lang niets doet is van een kapotte
   knop niet te onderscheiden — dat was bij de verbindingstest al eens
   gerepareerd en hier blijven staan.

   En kwamen er geen rekeningen terug, dan zei een melding van vijf
   tellen dat, terwijl er juist iets van je gevraagd wordt: in de
   beperkte modus van Enable Banking moet je je rekeningen daar eerst
   zelf koppelen. Dat hoort te blijven staan.

   Draaien:  node test/rekeningkeuze.mjs   (met een server op poort 8123)
   ===================================================================== */

/* "Andere rekening" deed een verzoek aan je bank en liet ondertussen
   niets zien. Reageert hij nu meteen, en zegt hij iets bruikbaars als
   er geen rekeningen terugkomen? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function metRekeningen(lijst, { traag = 0 } = {}) {
  const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
  p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
  await p.route("**/dienst.test/**", async r => {
    if (traag) await new Promise(k => setTimeout(k, traag));
    const u = r.request().url();
    const lijf = u.endsWith("/sessie") ? { sessie: "sess-1" }
      : u.endsWith("/rekeningen") ? { rekeningen: lijst, bank: "Rabobank", geldigTot: "2027-05-01" }
      : { klaar: true, dienst: "v29" };
    r.fulfill({ status: 200, contentType: "application/json",
                headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(lijf) });
  });
  await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
  await p.waitForSelector("#bankadres");
  await p.fill("#bankadres", "https://dienst.test");
  await p.fill("#bankwoord", "geheim");
  await p.waitForTimeout(800);
  await p.evaluate(async () => {
    const B = await import("./js/bank.js");
    const S = await import("./js/store.js");
    await B.neemOver("s:sess-1");
    S.meld();
  });
  await p.waitForTimeout(900);
  return p;
}

console.log("\n— twee rekeningen, dus jij kiest —");
let p = await metRekeningen([
  { id: "a", iban: "NL00RABO0111111111", naam: "Betaalrekening" },
  { id: "b", iban: "NL00RABO0222222222", naam: "Spaarrekening" },
], { traag: 700 });
check("hij staat gekoppeld, zonder rekening", /nog niet gekozen/.test(await p.locator("#scherm").textContent()));

/* Niet afwachten: meteen kijken of de knop zichtbaar reageert. */
p.locator("[data-bank-rekening]").click().catch(() => {});
await p.waitForTimeout(250);
check("de knop reageert meteen zichtbaar",
  /Bezig/.test(await p.locator("[data-bank-rekening]").textContent()));

await p.waitForTimeout(1500);
check("de keuzelijst opent", await p.locator(".dialoog").count() === 1);
const venster = await p.locator(".dialoog").textContent();
check("met beide rekeningen", /Betaalrekening/.test(venster) && /Spaarrekening/.test(venster));

await p.locator("[data-kies='b']").click();
await p.waitForTimeout(900);
const na = await p.locator("#scherm").textContent();
check("de gekozen rekening staat er", /NL00RABO0222222222/.test(na), na.slice(0, 200));
check("en de knop is weer normaal",
  /Andere rekening/.test(await p.locator("[data-bank-rekening]").textContent()));

console.log("\n— geen rekeningen: dat moet blijven staan —");
p = await metRekeningen([]);
await p.locator("[data-bank-rekening]").click();
await p.waitForTimeout(1500);
const leeg = await p.locator("#scherm").textContent();
check("er staat een blijvende uitleg", /geen rekeningen terug/.test(leeg), leeg.slice(0, 200));
check("met wat je moet doen bij Enable Banking", /linking accounts/.test(leeg));
check("geen keuzelijst", await p.locator(".dialoog").count() === 0);
check("en het spoor zegt hoeveel er terugkwamen",
  /rekeningen terug: 0/.test(await p.locator("[data-spoor]").textContent()));

console.log("\n— dezelfde melding stapelt niet —");
await p.locator("[data-bank-rekening]").click();
await p.waitForTimeout(1200);
check("nog steeds één melding", await p.locator(".melding--fout").count() === 1,
  String(await p.locator(".melding--fout").count()));

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
