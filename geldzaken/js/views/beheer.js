/* =====================================================================
   GELDZAKEN — wie mag erbij
   =====================================================================
   Het beheerdersscherm. Iedereen met de link kan een account maken,
   maar zo'n account is eerst niet meer dan een aanvraag: een naam en
   een e-mailadres in de wachtrij. Hier zie je die aanvragen en bepaal
   je wie er echt bij je cijfers mag, en met welke rechten.

   Drie rollen:
     kijker    — mag alles zien, niets wijzigen
     bewerker  — mag boekingen, potjes en vaste lasten aanpassen
     beheerder — mag dat, én mag anderen toelaten

   Wat je hier klikt wordt door Firestore gecontroleerd. Iemand die de
   regels probeert te omzeilen door zelf zijn status op "actief" te
   zetten, krijgt van de database gewoon nul op het rekest.
   ===================================================================== */

import { esc, melding, bevestig, dialoog, kleurVoor, initialen, datumNL } from "../util.js";
import { Sync, isBeheerder } from "../store.js";
import { leeg } from "./onderdelen.js";
import {  } from "../app.js";

export const titel = () => "Wie mag erbij";
export const ondertitel = () => "Toegang tot je financiën";
export const terugknop = true;
export const terugNaar = "#/instellingen";

const ROLLEN = {
  beheerder: { label: "Beheerder", uitleg: "Mag alles, en mag anderen toelaten." },
  bewerker:  { label: "Bewerker",  uitleg: "Mag boekingen en potjes aanpassen." },
  kijker:    { label: "Kijker",    uitleg: "Mag alleen meekijken." },
};

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const s = Sync.sync;

  if (!s.beschikbaar) {
    return `
      ${leeg({
        icoon: "🔐",
        titel: "Toegangsbeheer werkt met een account",
        tekst: "Zolang er geen Firebase is ingesteld draait de app alleen op dit apparaat, en is er dus ook niets af te schermen.",
      })}
      <div class="kaart">
        <p style="font-size:.86rem;color:var(--tekst-zacht);margin:0">
          In <code>firebase-config.js</code> en <code>firestore.rules</code> staat hoe je inloggen aanzet.
          Daarna kan iedereen zich aanmelden, maar bepaal jij wie erbij mag.
        </p>
      </div>`;
  }

  if (!isBeheerder()) {
    return leeg({
      icoon: "🙈",
      titel: "Alleen voor de beheerder",
      tekst: "Dit scherm hoort bij degene die het huishouden beheert.",
    });
  }

  const leden = [...s.leden].sort((a, b) => (b.aangemeld || 0) - (a.aangemeld || 0));
  const wachtend = leden.filter(l => l.status === "wacht");
  const actief = leden.filter(l => l.status === "actief");
  const rest = leden.filter(l => !["wacht", "actief"].includes(l.status));

  return `
    <div class="kaart">
      <div class="kaart__kop"><h2>Hoe het werkt</h2></div>
      <p style="font-size:.86rem;color:var(--tekst-zacht);margin:0">
        Wie de link opent kan een account aanvragen. Die aanvraag komt hieronder te staan
        en ziet zelf niets van je cijfers. Pas als jij hem toelaat, gaat de deur open —
        met de rechten die jij kiest.
      </p>
    </div>

    ${wachtend.length ? `
      <div class="sectiekop">
        <h2>Wacht op jou <span class="label label--letop">${wachtend.length}</span></h2>
      </div>
      ${wachtend.map(lidKaart).join("")}` : `
      <div class="sectiekop"><h2>Wacht op jou</h2></div>
      <div class="kaart"><p style="margin:0;font-size:.87rem;color:var(--tekst-zacht)">Geen openstaande aanmeldingen.</p></div>`}

    <div class="sectiekop"><h2>Toegelaten (${actief.length})</h2></div>
    ${actief.length ? actief.map(lidKaart).join("") : `
      <div class="kaart"><p style="margin:0;font-size:.87rem;color:var(--tekst-zacht)">Nog niemand toegelaten.</p></div>`}

    ${rest.length ? `
      <details class="uitklap" style="margin-top:16px">
        <summary>Geweigerd of geblokkeerd (${rest.length})</summary>
        <div>${rest.map(lidKaart).join("")}</div>
      </details>` : ""}

    <div class="sectiekop"><h2>Iemand uitnodigen</h2></div>
    <div class="kaart">
      <p style="font-size:.86rem;color:var(--tekst-zacht)">
        Stuur de link van de app door. Diegene maakt een account en verschijnt hier in de wachtrij.
      </p>
      <div class="knoprij knoprij--gelijk">
        <button class="knop" data-deel>Link delen</button>
        <button class="knop knop--rand" data-kopieer>Link kopiëren</button>
      </div>
    </div>`;
}

function lidKaart(lid) {
  const ikZelf = lid.uid === Sync.sync.gebruiker?.uid;
  const naam = lid.naam || lid.email || "Onbekend";
  const rol = ROLLEN[lid.rol]?.label || "Kijker";

  const statusLabel = {
    wacht:       `<span class="label label--letop">wacht op goedkeuring</span>`,
    actief:      `<span class="label label--goed">toegelaten</span>`,
    geweigerd:   `<span class="label label--fout">geweigerd</span>`,
    geblokkeerd: `<span class="label label--fout">geblokkeerd</span>`,
  }[lid.status] || "";

  return `
    <div class="kaart" style="padding:13px">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="lid__bol" style="background:${kleurVoor(naam)}">${esc(initialen(naam))}</span>
        <span class="lid__midden">
          <span class="lid__naam">${esc(naam)} ${ikZelf ? `<span class="label">jij</span>` : ""}</span>
          <span class="lid__mail">${esc(lid.email || "")}</span>
          <span class="lid__labels">
            ${statusLabel}
            ${lid.status === "actief" ? `<span class="label label--info">${esc(rol)}</span>` : ""}
            ${lid.emailBevestigd ? `<span class="label label--goed">e-mail bevestigd</span>` : `<span class="label">e-mail niet bevestigd</span>`}
          </span>
        </span>
      </div>

      <div class="lid__mail" style="margin-top:8px">
        Aangemeld ${esc(lid.aangemeld ? datumNL(new Date(lid.aangemeld).toISOString().slice(0, 10), { kort: true }) : "—")}
        ${lid.laatsteLogin ? ` · laatst gezien ${esc(datumNL(new Date(lid.laatsteLogin).toISOString().slice(0, 10), { kort: true }))}` : ""}
      </div>

      ${ikZelf ? "" : `
        <div class="lid__acties">
          ${lid.status === "wacht" ? `
            <button class="knop knop--klein knop--primair" data-goedkeur="${esc(lid.uid)}">Toelaten</button>
            <button class="knop knop--klein" data-weiger="${esc(lid.uid)}">Weigeren</button>
          ` : ""}
          ${lid.status === "actief" ? `
            <button class="knop knop--klein" data-rol="${esc(lid.uid)}">Rol wijzigen</button>
            <button class="knop knop--klein" data-blokkeer="${esc(lid.uid)}">Toegang pauzeren</button>
          ` : ""}
          ${["geweigerd", "geblokkeerd"].includes(lid.status) ? `
            <button class="knop knop--klein knop--primair" data-goedkeur="${esc(lid.uid)}">Alsnog toelaten</button>
          ` : ""}
          <button class="knop knop--klein" data-verwijder="${esc(lid.uid)}">Verwijderen</button>
        </div>`}
    </div>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  wortel.addEventListener("click", async e => {
    const doe = async (fn, tekst) => {
      try { await fn(); melding(tekst, "goed"); }
      catch (fout) { melding(Sync.foutTekst(fout), "fout"); }
    };

    const goed = e.target.closest("[data-goedkeur]");
    if (goed) {
      const uid = goed.dataset.goedkeur;
      const lid = Sync.sync.leden.find(l => l.uid === uid);
      const rol = await kiesRol(lid?.rol || "bewerker");
      if (!rol) return;
      return doe(() => Sync.keurGoed(uid, rol), `${lid?.naam || "Iemand"} is toegelaten.`);
    }

    const weiger = e.target.closest("[data-weiger]");
    if (weiger) {
      const lid = Sync.sync.leden.find(l => l.uid === weiger.dataset.weiger);
      const zeker = await bevestig(`${lid?.naam || lid?.email} krijgt geen toegang.`, { bevestigLabel: "Weigeren", gevaar: true });
      if (!zeker) return;
      return doe(() => Sync.weiger(weiger.dataset.weiger), "Aanmelding geweigerd.");
    }

    const rolKnop = e.target.closest("[data-rol]");
    if (rolKnop) {
      const lid = Sync.sync.leden.find(l => l.uid === rolKnop.dataset.rol);
      const rol = await kiesRol(lid?.rol || "kijker");
      if (!rol) return;
      return doe(() => Sync.zetRol(rolKnop.dataset.rol, rol), "Rol aangepast.");
    }

    const blok = e.target.closest("[data-blokkeer]");
    if (blok) {
      const lid = Sync.sync.leden.find(l => l.uid === blok.dataset.blokkeer);
      const zeker = await bevestig(
        `${lid?.naam || lid?.email} ziet daarna niets meer, maar blijft wel in de lijst staan zodat je hem later weer kunt toelaten.`,
        { titel: "Toegang pauzeren", bevestigLabel: "Pauzeren", gevaar: true });
      if (!zeker) return;
      return doe(() => Sync.blokkeer(blok.dataset.blokkeer), "Toegang gepauzeerd.");
    }

    const weg = e.target.closest("[data-verwijder]");
    if (weg) {
      const lid = Sync.sync.leden.find(l => l.uid === weg.dataset.verwijder);
      const zeker = await bevestig(
        `${lid?.naam || lid?.email} verdwijnt uit de lijst. Met hetzelfde account kan diegene zich daarna opnieuw aanmelden.`,
        { titel: "Uit de lijst halen", bevestigLabel: "Verwijderen", gevaar: true });
      if (!zeker) return;
      return doe(() => Sync.verwijderLid(weg.dataset.verwijder), "Verwijderd.");
    }

    if (e.target.closest("[data-deel]")) {
      const gegevens = { title: "Geldzaken", text: "Meld je aan, dan zet ik je erbij.", url: location.href.split("#")[0] };
      if (navigator.share) { try { await navigator.share(gegevens); } catch { /* afgebroken */ } }
      else { await kopieer(gegevens.url); }
      return;
    }

    if (e.target.closest("[data-kopieer]")) return kopieer(location.href.split("#")[0]);
  });
}

async function kopieer(tekst) {
  try {
    await navigator.clipboard.writeText(tekst);
    melding("Link gekopieerd.", "goed");
  } catch {
    melding(tekst);
  }
}

/* Rol kiezen bij het toelaten. */
function kiesRol(huidig) {
  return dialoog({
    titel: "Welke rechten?",
    inhoud: `
      <div class="veld">
        ${Object.entries(ROLLEN).reverse().map(([id, r]) => `
          <label class="schakelrij" style="cursor:pointer">
            <span class="schakelrij__tekst">
              <span class="schakelrij__titel">${esc(r.label)}</span>
              <span class="schakelrij__uitleg">${esc(r.uitleg)}</span>
            </span>
            <input type="radio" name="rol" value="${id}" ${huidig === id ? "checked" : ""}
                   style="width:22px;height:22px;flex:none;accent-color:var(--accent)">
          </label>`).join("")}
      </div>`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Bevestigen", soort: "primair",
        waardeUit: laag => laag.querySelector("input[name=rol]:checked")?.value || undefined,
      },
    ],
  });
}
