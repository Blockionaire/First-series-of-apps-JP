/* =====================================================================
   GELDZAKEN — zelf ophalen, en eraan herinneren
   =====================================================================
   Een app in een browser draait niet op de achtergrond, dus "zelf
   ophalen" betekent: bij het openen, als het lang genoeg geleden is.
   Nooit vaker dan eens per dag — je bank staat maar een paar rondes toe
   en je afschrift verandert niet sneller dan je uitgeeft.

   En laat je het liggen, dan zegt je startscherm na een week hoe lang
   het geleden is, met een tik die je meteen naar het inlezen brengt.
   Een melding die zegt wat je moet doen en je daar niet brengt, laat
   het werk bij jou.

   Draaien:  node test/ritme.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Mag de app zelf ophalen, hoe vaak, en zegt hij het als je het laat
   liggen? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let gevraagd = 0;

async function app({ ritme, laatst, laatstVerwerkt, aantal = 3 }) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
  await p.route("**/dienst.test/**", r => {
    const u = r.request().url();
    if (u.endsWith("/transacties")) gevraagd++;
    const lijf = u.endsWith("/transacties")
      ? { transacties: Array.from({ length: aantal }, (_, i) => ({
          datum: "2026-11-2" + i, bedrag: 10 + i, soort: "uitgave",
          omschrijving: "Winkel " + i, tegenpartij: "Winkel " + i, ref: "r" + i })) }
      : u.endsWith("/rekeningen") ? { rekeningen: [{ id: "a", iban: "NL00RABO0111111111" }], bank: "Rabobank" }
      : { klaar: true, dienst: "v32" };
    r.fulfill({ status: 200, contentType: "application/json",
                headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(lijf) });
  });

  /* Een bestaande koppeling neerzetten vóór de app start. */
  await p.addInitScript(({ ritme, laatst, laatstVerwerkt }) => {
    window.__opzet = { ritme, laatst, laatstVerwerkt };
  }, { ritme, laatst, laatstVerwerkt });

  await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.evaluate(async o => {
    const B = await import("./js/bank.js");
    Object.assign(B.bank, {
      adres: "https://dienst.test", woord: "geheim", sessie: "s1",
      rekening: "a", rekeningNaam: "NL00RABO0111111111", bankNaam: "Rabobank",
      ritme: o.ritme, laatst: o.laatst, laatstVerwerkt: o.laatstVerwerkt, geladen: true,
    });
  }, { ritme, laatst, laatstVerwerkt });
  return p;
}

const dag = 86400_000;

console.log("\n— het ritme staat in de instellingen —");
let p = await app({ ritme: "uit", laatst: Date.now(), laatstVerwerkt: Date.now() });
await p.evaluate(async () => (await import("./js/store.js")).meld());
await p.waitForTimeout(500);
check("er is een keuze", await p.locator("#bankritme").count() === 1);
const opties = await p.locator("#bankritme option").allTextContents();
check("met nooit, week en dag", opties.join("|") === "Nooit|Eens per week|Eens per dag", opties.join("|"));

console.log("\n— uit betekent uit —");
gevraagd = 0;
let n = await p.evaluate(async () => (await import("./js/bank.js")).haalZelfOp());
check("hij haalt niets op", n === null && gevraagd === 0, `${n}, ${gevraagd} verzoeken`);

console.log("\n— eens per dag, en het is nog geen dag geleden —");
p = await app({ ritme: "dag", laatst: Date.now() - 3600_000, laatstVerwerkt: Date.now() });
gevraagd = 0;
n = await p.evaluate(async () => (await import("./js/bank.js")).haalZelfOp());
check("hij wacht netjes", n === null && gevraagd === 0, `${n}, ${gevraagd} verzoeken`);

console.log("\n— eens per dag, en het is twee dagen geleden —");
p = await app({ ritme: "dag", laatst: Date.now() - 2 * dag, laatstVerwerkt: Date.now() - 2 * dag });
gevraagd = 0;
n = await p.evaluate(async () => (await import("./js/bank.js")).haalZelfOp());
check("hij haalt op", n === 3, String(n));
check("en vroeg het één keer", gevraagd === 1, String(gevraagd));

n = await p.evaluate(async () => (await import("./js/bank.js")).haalZelfOp());
check("en niet nog een keer", n === null && gevraagd === 1, `${n}, ${gevraagd}`);

/* Het bericht hoort op je startscherm, niet in de instellingen. Alleen
   het anker wisselen houdt de opgehaalde boekingen in het geheugen. */
await p.goto("http://127.0.0.1:8123/index.html#/start");
await p.waitForTimeout(600);
let tekst = await p.locator("#scherm").textContent();
check("het staat als bericht op je startscherm", /3 boekingen staan klaar/.test(tekst), tekst.slice(0, 160));
check("en het is aan te tikken",
  (await p.locator('a.signaal[href="#/importeren"]').count()) === 1);

console.log("\n— eens per week laat een dag met rust —");
p = await app({ ritme: "week", laatst: Date.now() - 2 * dag, laatstVerwerkt: Date.now() - 2 * dag });
gevraagd = 0;
n = await p.evaluate(async () => (await import("./js/bank.js")).haalZelfOp());
check("twee dagen is te vroeg voor wekelijks", n === null && gevraagd === 0, `${n}, ${gevraagd}`);

console.log("\n— en de herinnering na een week —");
p = await app({ ritme: "uit", laatst: Date.now() - 9 * dag, laatstVerwerkt: Date.now() - 9 * dag });
await p.goto("http://127.0.0.1:8123/index.html#/start", { waitUntil: "networkidle" });
await p.evaluate(async () => {
  const B = await import("./js/bank.js"); const S = await import("./js/store.js");
  Object.assign(B.bank, { adres: "https://dienst.test", woord: "geheim", sessie: "s1",
    rekening: "a", laatst: Date.now() - 9 * 86400000, laatstVerwerkt: Date.now() - 9 * 86400000 });
  S.meld();
});
await p.waitForTimeout(600);
tekst = await p.locator("#scherm").textContent();
check("hij zegt hoeveel dagen", /Al 9 dagen geen boekingen opgehaald/.test(tekst), tekst.slice(0, 200));
check("en je kunt er meteen heen",
  (await p.locator('a.signaal[href="#/importeren"]').count()) === 1);

await p.locator('a.signaal[href="#/importeren"]').click();
await p.waitForTimeout(700);
check("de tik brengt je naar het inlezen", /#\/importeren/.test(p.url()), p.url());

console.log("\n— en zonder reden zwijgt hij —");
p = await app({ ritme: "uit", laatst: Date.now() - 2 * dag, laatstVerwerkt: Date.now() - 2 * dag });
await p.goto("http://127.0.0.1:8123/index.html#/start", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
check("twee dagen is geen bericht waard",
  !/dagen geen boekingen/.test(await p.locator("#scherm").textContent()));

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
