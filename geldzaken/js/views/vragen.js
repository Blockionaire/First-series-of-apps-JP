/* =====================================================================
   GELDZAKEN — vragen over je geld
   =====================================================================
   Een gespreksvenster waarin je gewoon kunt vragen hoe het ervoor
   staat. De vraagbalk uit vraag.js probeert het eerst zelf: dat gaat
   direct, kost niets, werkt offline en er verlaat geen cijfer je
   apparaat.

   Herkent hij de vraag niet, dan is er één van twee uitkomsten:

     - staat de AI uit (standaard), dan zegt hij eerlijk dat hij het
       niet weet en laat zien wat hij wél begrijpt;
     - staat hij aan, dan gaat de vraag naar je eigen bankdienst, die
       hem met jouw sleutel aan Claude voorlegt. Er gaat dan een
       samenvatting in cijfers mee — geen losse boekingen, geen
       tegenpartijen, geen rekeningnummers.

   Het gesprek staat alleen in het geheugen. Sluit je de app, dan is het
   weg. Dat is met opzet: er is geen reden om vragen over je geld ergens
   te bewaren.
   ===================================================================== */

import { esc, geld, melding } from "../util.js";
import { state, meld } from "../store.js";
import { beantwoord, voorbeelden } from "../vraag.js";
import * as Bank from "../bank.js";

export const titel = () => "Vragen";
export const ondertitel = () => "over je eigen cijfers";
export const terugknop = true;
export const terugNaar = "#/start";

/* { van: "jij" | "app", tekst, regels?, route?, bron? } */
let gesprek = [];
let bezig = false;

export function opBinnenkomst() { bezig = false; }

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  return `
    <div class="gesprek" id="gesprek">
      ${gesprek.length ? gesprek.map(bericht).join("") : welkom()}
      ${bezig ? `
        <div class="bericht bericht--app">
          <div class="bericht__bel"><span class="dof">Even kijken…</span></div>
        </div>` : ""}
    </div>

    ${!gesprek.length ? `
      <div class="suggesties">
        ${voorbeelden().map(v => `
          <button class="chip chip--vraag" data-vraag="${esc(v)}">${esc(v)}</button>`).join("")}
      </div>` : ""}

    <form class="vraagbalk" id="vraagbalk" autocomplete="off">
      <input type="text" id="vraagveld" placeholder="Vraag iets over je geld…"
             aria-label="Je vraag" ${bezig ? "disabled" : ""}>
      <button class="icoonknop icoonknop--primair" type="submit" aria-label="Vragen" ${bezig ? "disabled" : ""}>↑</button>
    </form>

    ${gesprek.length ? `
      <button class="knop knop--stil knop--breed" data-wis style="margin-top:10px">Gesprek wissen</button>` : ""}`;
}

function welkom() {
  const aan = Bank.bank.aiAan;
  return `
    <div class="leeg" style="padding:28px 10px">
      <div class="leeg__icoon" aria-hidden="true">💬</div>
      <div class="leeg__titel">Vraag maar</div>
      <p>
        Ik reken het antwoord uit op dit apparaat — direct, en er gaat niets de deur uit.
        ${aan ? "Weet ik het niet, dan leg ik je vraag voor aan Claude." : ""}
      </p>
    </div>`;
}

function bericht(b) {
  if (b.van === "jij") {
    return `<div class="bericht bericht--jij"><div class="bericht__bel">${esc(b.tekst)}</div></div>`;
  }
  return `
    <div class="bericht bericht--app">
      <div class="bericht__bel">
        <p style="margin:0">${esc(b.tekst)}</p>
        ${b.regels?.length ? `
          <div class="bericht__regels">
            ${b.regels.slice(0, 8).map(r => `
              <div class="bericht__regel">
                <span class="bericht__regel-naam">${esc(r.naam)}</span>
                ${r.bij ? `<span class="dof" style="font-size:.74rem">${esc(r.bij)}</span>` : ""}
                <span class="bedrag">${geld(r.bedrag)}</span>
              </div>`).join("")}
          </div>` : ""}
        ${b.route ? `<a class="bericht__link" href="${esc(b.route)}">Laat zien →</a>` : ""}
        ${b.bron === "ai" ? `<div class="bericht__bron dof">via Claude</div>` : ""}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  const veld = wortel.querySelector("#vraagveld");
  if (!bezig) setTimeout(() => veld?.focus({ preventScroll: true }), 60);
  naarBeneden(wortel);

  wortel.querySelector("#vraagbalk")?.addEventListener("submit", e => {
    e.preventDefault();
    const tekst = veld?.value || "";
    if (veld) veld.value = "";
    stel(tekst);
  });

  wortel.addEventListener("click", e => {
    const chip = e.target.closest("[data-vraag]");
    if (chip) return stel(chip.dataset.vraag);
    if (e.target.closest("[data-wis]")) { gesprek = []; return meld(); }
  });
}

function naarBeneden(wortel) {
  const lijst = wortel.querySelector("#gesprek");
  if (lijst) lijst.scrollTop = lijst.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
}

/* ---------------------------------------------------------------
   Een vraag afhandelen
   --------------------------------------------------------------- */
async function stel(vraag) {
  const tekst = String(vraag || "").trim();
  if (!tekst || bezig) return;

  gesprek.push({ van: "jij", tekst });

  /* Eerst zelf proberen. Dit is het gewone geval en het gaat zo snel
     dat er geen wachtmoment in zit. */
  const zelf = beantwoord(tekst);
  if (zelf) {
    gesprek.push({ van: "app", ...zelf });
    return meld();
  }

  /* Niet herkend. Zonder AI zeggen we dat gewoon. */
  if (!Bank.bank.aiAan || !Bank.ingesteld()) {
    gesprek.push({
      van: "app",
      tekst: "Die vraag begrijp ik niet. Ik kan wel uit de voeten met vragen over je uitgaven per potje, wat er nog over is, waar je geld heen gaat, je inkomen, je spaardoelen en je budget." +
        (Bank.ingesteld() ? " Wil je vrijer kunnen vragen, dan kun je Claude aanzetten onder ⚙️ → Je bank." : ""),
    });
    return meld();
  }

  bezig = true;
  meld();
  try {
    const antwoord = await Bank.vraagAanAI(tekst, gesprek
      .filter(b => b.van === "jij" || b.bron === "ai")
      .slice(-6)
      .map(b => ({ rol: b.van === "jij" ? "user" : "assistant", tekst: b.tekst })));
    gesprek.push({ van: "app", tekst: antwoord, bron: "ai" });
  } catch (fout) {
    gesprek.push({ van: "app", tekst: fout.message || "Het lukte niet om je vraag voor te leggen." });
  } finally {
    bezig = false;
    meld();
  }
}
