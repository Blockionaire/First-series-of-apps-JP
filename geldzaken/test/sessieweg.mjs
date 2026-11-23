/* =====================================================================
   GELDZAKEN — een koppeling die er niet meer is
   =====================================================================
   De app bewaarde een sessie die bij Enable Banking niet bestond, en
   bleef "Gekoppeld met Rabobank" tonen boven een knop die bij elke tik
   dezelfde klacht gaf. Niets bracht je op het idee om gewoon opnieuw te
   koppelen — terwijl dat het enige was wat hielp.

   Zegt je bank dat de sessie niet bestaat, dan laat de app de koppeling
   nu los. Adres en woord blijven staan; die zijn nog goed.

   Draaien:  node test/sessieweg.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Zegt je bank dat de sessie niet bestaat, dan hoort de app te stoppen
   met doen alsof je gekoppeld bent. */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));

let rekeningenAntwoord = () => ({ status: 200, lijf: { rekeningen: [{ id: "a", iban: "NL00RABO0111111111" }], bank: "Rabobank" } });
await p.route("**/dienst.test/**", r => {
  const u = r.request().url();
  const uit = u.endsWith("/rekeningen") ? rekeningenAntwoord()
    : u.endsWith("/sessie") ? { status: 200, lijf: { sessie: "nieuw-sess" } }
    : { status: 200, lijf: { klaar: true, dienst: "v32" } };
  r.fulfill({ status: uit.status, contentType: "application/json",
              headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(uit.lijf) });
});

await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
await p.waitForSelector("#bankadres");
await p.fill("#bankadres", "https://dienst.test");
await p.fill("#bankwoord", "geheim");
await p.waitForTimeout(800);

console.log("\n— eerst een geldige koppeling —");
await p.evaluate(async () => {
  const B = await import("./js/bank.js"); const S = await import("./js/store.js");
  await B.neemOver("s:sess-1"); S.meld();
});
await p.waitForTimeout(800);
check("hij staat gekoppeld", /Gekoppeld met/.test(await p.locator("#scherm").textContent()));

console.log("\n— en dan bestaat die sessie niet meer —");
rekeningenAntwoord = () => ({ status: 404, lijf: {
  fout: "Deze koppeling bestaat niet meer bij je bank. Koppel je rekening opnieuw.",
  opnieuw: true, dienst: "v32" } });
await p.locator("[data-bank-rekening]").click();
await p.waitForTimeout(1500);
const na = await p.locator("#scherm").textContent();
check("de app houdt niet vol dat je gekoppeld bent", !/Gekoppeld met/.test(na), na.slice(0, 200));
check("en zegt dat je opnieuw moet koppelen", /bestaat niet meer bij je bank/.test(na));
check("de koppelknoppen staan er weer", await p.locator("[data-bank-koppel]").count() === 1);
check("het spoor legt het vast",
  /sessie bestaat niet meer/.test(await p.locator("[data-spoor]").textContent()));

const bewaard = await p.evaluate(() => new Promise(k => {
  const v = indexedDB.open("geldzaken");
  v.onsuccess = () => {
    const r = v.result.transaction("apparaat").objectStore("apparaat").get("bank");
    r.onsuccess = () => k(r.result || null);
  };
}));
check("de sessie is ook uit de opslag", !bewaard?.sessie, JSON.stringify(bewaard?.sessie));
check("maar adres en woord blijven staan", !!bewaard?.adres && !!bewaard?.woord);

console.log("\n— een code zonder voorvoegsel plakken —");
rekeningenAntwoord = () => ({ status: 404, lijf: {
  fout: "Deze koppeling bestaat niet meer bij je bank.", opnieuw: true, dienst: "v32" } });
const uitslag = await p.evaluate(async () => {
  const B = await import("./js/bank.js");
  /* Eerst faalt hij als sessie; daarna wordt hij alsnog als code
     ingewisseld, en die nieuwe sessie werkt wel. */
  let beurt = 0;
  try {
    await B.neemOver("code-zonder-voorvoegsel");
    return { ok: true, sessie: B.bank.sessie };
  } catch (e) { return { ok: false, fout: e.message }; }
});
check("hij probeert hem alsnog als code in te wisselen",
  /geen sessie — dan was het misschien een code/.test(await p.locator("[data-spoor]").textContent()));

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
