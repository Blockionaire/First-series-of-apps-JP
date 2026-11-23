/* =====================================================================
   GELDZAKEN — de koppeling op de goede plek krijgen
   =====================================================================
   Koppel je vanuit de app op je beginscherm, dan stuurt je bank je
   browser terug. En die browser heeft jouw adres en woord ook, dus hij
   wisselt de code keurig in en koppelt zichzélf — terwijl je het op je
   beginscherm wilde. Daar merkte je niets van, want het
   overdrachtskaartje verscheen alleen als het inwisselen daar juist
   níét kon.

   Dus biedt de app de overdracht nu uit zichzelf aan zodra dit niet de
   app op je beginscherm is. En laat hij hem weg waar dat niet nodig is.

   Draaien:  node test/doorgeven.mjs   (met een server op poort 8123)
   ===================================================================== */

/* Koppel je in een browser, dan is je beginscherm nog nergens. Biedt de
   app de overdracht dan uit zichzelf aan? En laat hij hem weg waar dat
   niet nodig is? */
import pw from "playwright";
const { chromium } = pw;
let goed = 0, mis = 0;
const check = (n, ok, e = "") => ok ? (goed++, console.log(`  ok   ${n}`)) : (mis++, console.log(`  MIS  ${n} — ${e}`));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function koppelen({ beginscherm }) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  /* Zo ziet een app vanaf je beginscherm eruit voor de pagina zelf. */
  if (beginscherm) {
    await ctx.addInitScript(() => {
      const echt = window.matchMedia.bind(window);
      window.matchMedia = q => q.includes("display-mode: standalone")
        ? { matches: true, addEventListener() {}, removeEventListener() {} } : echt(q);
    });
  }
  const p = await ctx.newPage();
  p.on("pageerror", f => console.log("PAGINAFOUT:", String(f)));
  await p.route("**/dienst.test/**", r => {
    const u = r.request().url();
    const lijf = u.endsWith("/sessie") ? { sessie: "sess-999" }
      : u.endsWith("/rekeningen") ? { rekeningen: [{ id: "a", iban: "NL00RABO0111111111" }], bank: "Rabobank" }
      : { klaar: true, dienst: "v32" };
    r.fulfill({ status: 200, contentType: "application/json",
                headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(lijf) });
  });

  await p.goto("http://127.0.0.1:8123/index.html#/instellingen", { waitUntil: "networkidle" });
  await p.waitForSelector("#bankadres");
  await p.fill("#bankadres", "https://dienst.test");
  await p.fill("#bankwoord", "geheim");
  await p.waitForTimeout(800);
  /* En nu komt je bank terug met een code. */
    /* Een vraagteken erbij, anders is dit voor de browser dezelfde pagina
     met een ander anker — en dan laadt hij niet opnieuw. De terugkeer
     van je bank is wél een volledige lading. */
  await p.goto("http://127.0.0.1:8123/index.html?terug=1#bankcode=code-abc", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  return p;
}

console.log("\n— je koppelt in een browser —");
let p = await koppelen({ beginscherm: false });
let tekst = await p.locator("#scherm").textContent();
check("hij is hier gekoppeld", /Gekoppeld met/.test(tekst), tekst.slice(0, 160));
check("en biedt de overdracht aan", /ook vanaf je beginscherm/.test(tekst));
check("met de sessie als code", /s:sess-999/.test(await p.locator("[data-overdracht]").textContent()));
check("zonder valse haast", /haast heb je niet/.test(tekst));
check("en het weggooien mag", await p.locator("[data-code-vergeet]").count() === 1);

console.log("\n— je koppelt vanaf je beginscherm —");
p = await koppelen({ beginscherm: true });
tekst = await p.locator("#scherm").textContent();
check("de startregel klopt", /vanaf beginscherm/.test(await p.locator("[data-spoor]").textContent()));
check("hij is gekoppeld", /Gekoppeld met/.test(tekst));
check("en biedt géén overdracht aan", !/vanaf je beginscherm\?/.test(tekst));
check("er staat geen codevak", await p.locator("[data-overdracht]").count() === 0);

await browser.close();
console.log(`\n${goed} goed, ${mis} mis`);
process.exit(mis ? 1 : 0);
