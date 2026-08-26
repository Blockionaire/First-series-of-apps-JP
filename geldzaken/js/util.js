/* =====================================================================
   GELDZAKEN — gereedschap
   =====================================================================
   Kleine hulpjes die overal terugkomen: selecteren, opmaken, maanden
   rekenen, dialogen en een paar grafiekjes in kale SVG.

   Eén ding is bijzonder aan deze app: `geld()` kan bedragen verbergen.
   Met de privacyknop staat er •••• in plaats van je saldo, handig in de
   trein of als je het scherm deelt.
   ===================================================================== */

/* ---------------------------------------------------------------
   DOM
   --------------------------------------------------------------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Alles wat uit de gegevens komt gaat hier doorheen voordat het in
   innerHTML belandt. Een omschrijving als "Bakker <& zn>" mag het
   scherm niet slopen. */
export function esc(waarde) {
  if (waarde == null) return "";
  return String(waarde)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------------------------------------------------------------
   Bedragen
   --------------------------------------------------------------- */
let VALUTA = "EUR";
let PRIVACY = false;

export const zetValuta  = v => { VALUTA = v || "EUR"; };
export const zetPrivacy = aan => { PRIVACY = !!aan; };
export const privacyAan = () => PRIVACY;

export function geld(bedrag, { decimalen = null, teken = false, leeg = "—", altijdTonen = false, compact = false } = {}) {
  const n = Number(bedrag);
  if (bedrag == null || bedrag === "" || !isFinite(n)) return leeg;
  if (PRIVACY && !altijdTonen) return "••••";

  const dec = decimalen != null ? decimalen : (Number.isInteger(n) ? 0 : 2);
  const opmaak = {
    style: "currency", currency: VALUTA,
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  };
  if (compact && Math.abs(n) >= 10000) {
    opmaak.notation = "compact";
    opmaak.maximumFractionDigits = 1;
    delete opmaak.minimumFractionDigits;
  }
  const tekst = new Intl.NumberFormat("nl-NL", opmaak).format(Math.abs(n));
  if (!teken) return n < 0 ? "−" + tekst : tekst;
  return (n < 0 ? "−" : "+") + tekst;
}

export function getal(n, decimalen = 0) {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimalen, maximumFractionDigits: decimalen,
  }).format(n);
}

export function procent(deel, geheel, decimalen = 0) {
  if (!geheel) return "0%";
  return getal((deel / geheel) * 100, decimalen) + "%";
}

/* Invoer als "12,50", "€ 1.234,56" of "1234.56" wordt een getal. */
export function leesBedrag(tekst) {
  if (typeof tekst === "number") return isFinite(tekst) ? tekst : null;
  let s = String(tekst || "").trim().replace(/[€\s]/g, "");
  if (!s) return null;
  const komma = s.lastIndexOf(",");
  const punt = s.lastIndexOf(".");
  if (komma > -1 && punt > -1) {
    /* Wat het laatst staat is de decimaalscheiding. */
    if (komma > punt) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (komma > -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/* ---------------------------------------------------------------
   Datums en maanden
   ---------------------------------------------------------------
   Een maand is overal in de app een tekst als "2026-03". Rekenen met
   Date-objecten voor maanden gaat op de 31e altijd mis, met tekst niet.
   --------------------------------------------------------------- */
export const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni",
                        "juli", "augustus", "september", "oktober", "november", "december"];
export const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

export const vandaagISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const maandVan = iso => String(iso || vandaagISO()).slice(0, 7);
export const maandNu = () => maandVan(vandaagISO());

export function maandPlus(maand, stappen) {
  const [j, m] = maand.split("-").map(Number);
  const totaal = j * 12 + (m - 1) + stappen;
  return `${Math.floor(totaal / 12)}-${String((totaal % 12) + 1).padStart(2, "0")}`;
}

export function maandenTussen(vanaf, tot) {
  const [j1, m1] = vanaf.split("-").map(Number);
  const [j2, m2] = tot.split("-").map(Number);
  return (j2 * 12 + m2) - (j1 * 12 + m1);
}

export function maandLabel(maand, { kort = false, jaar = true } = {}) {
  const [j, m] = maand.split("-").map(Number);
  const naam = MAANDEN[m - 1] || "";
  const stuk = kort ? naam.slice(0, 3) : naam;
  return jaar ? `${stuk} ${j}` : stuk;
}

export const dagenInMaand = maand => {
  const [j, m] = maand.split("-").map(Number);
  return new Date(j, m, 0).getDate();
};

/* Datum in een maand, met een dag die netjes binnen de maand valt. */
export function datumInMaand(maand, dag) {
  const laatste = dagenInMaand(maand);
  const d = Math.min(Math.max(Number(dag) || 1, 1), laatste);
  return `${maand}-${String(d).padStart(2, "0")}`;
}

export function datumNL(iso, { kort = false, metJaar = true, metDag = false } = {}) {
  if (!iso) return "—";
  const d = new Date(String(iso).length <= 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d)) return String(iso);
  const maand = kort ? MAANDEN[d.getMonth()].slice(0, 3) : MAANDEN[d.getMonth()];
  const dagnaam = metDag ? DAGEN[d.getDay()] + " " : "";
  return `${dagnaam}${d.getDate()} ${maand}${metJaar ? " " + d.getFullYear() : ""}`;
}

/* "vandaag", "morgen", "over 3 dagen", "5 dagen geleden" */
export function relatieveDatum(iso) {
  const dagen = dagenTot(iso);
  if (dagen === 0) return "vandaag";
  if (dagen === 1) return "morgen";
  if (dagen === -1) return "gisteren";
  if (dagen > 0) return `over ${dagen} dagen`;
  return `${-dagen} dagen geleden`;
}

export function dagenTot(iso) {
  const nu = new Date(vandaagISO() + "T12:00:00");
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  return Math.round((d - nu) / 86400000);
}

/* ---------------------------------------------------------------
   Tekst
   --------------------------------------------------------------- */
export const normaliseer = s =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* Altijd dezelfde kleur bij dezelfde naam — handig voor personen. */
const PALET = ["#3ddc97", "#5b8dff", "#f5a524", "#ff6b81", "#a78bfa", "#22d3ee", "#f472b6", "#84cc16"];
export function kleurVoor(tekst) {
  const s = String(tekst || "");
  let som = 0;
  for (let i = 0; i < s.length; i++) som = (som * 31 + s.charCodeAt(i)) % 100000;
  return PALET[som % PALET.length];
}

export const initialen = naam => {
  const woorden = String(naam || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return woorden.map(w => w[0]).join("").toUpperCase() || "?";
};

/* ---------------------------------------------------------------
   Meldingen
   --------------------------------------------------------------- */
export function melding(tekst, soort = "info") {
  let bak = $("#meldingen");
  if (!bak) {
    bak = document.createElement("div");
    bak.id = "meldingen";
    document.body.appendChild(bak);
  }
  const el = document.createElement("div");
  el.className = `melding melding--${soort}`;
  el.textContent = tekst;
  bak.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-zichtbaar"));
  setTimeout(() => {
    el.classList.remove("is-zichtbaar");
    setTimeout(() => el.remove(), 300);
  }, soort === "fout" ? 5200 : 2800);
}

/* ---------------------------------------------------------------
   Dialoogvenster
   ---------------------------------------------------------------
   `inhoud` is HTML. `knoppen` is een lijst {label, waarde, soort}. De
   belofte lost op met de waarde van de ingedrukte knop, of null bij
   sluiten. Een knop mag met `waardeUit(laag)` zelf bepalen wat er
   teruggaat — geeft die functie `undefined`, dan blijft het venster
   openstaan (bijvoorbeeld als een veld nog niet klopt).
   --------------------------------------------------------------- */
export function dialoog({ titel, inhoud, knoppen = [{ label: "Sluiten", waarde: null }], opOpenen, breed = false, onderaan = false }) {
  return new Promise(klaar => {
    const laag = document.createElement("div");
    laag.className = "dialoog-laag" + (onderaan ? " dialoog-laag--onder" : "");
    laag.innerHTML = `
      <div class="dialoog ${breed ? "dialoog--breed" : ""}" role="dialog" aria-modal="true" aria-label="${esc(titel)}">
        <header class="dialoog__kop">
          <h2>${esc(titel)}</h2>
          <button class="icoonknop icoonknop--kaal" data-sluit aria-label="Sluiten">✕</button>
        </header>
        <div class="dialoog__inhoud">${inhoud}</div>
        ${knoppen.length ? `<footer class="dialoog__voet">
          ${knoppen.map((k, i) => `
            <button class="knop ${k.soort ? "knop--" + k.soort : ""}" data-knop="${i}">${esc(k.label)}</button>
          `).join("")}
        </footer>` : ""}
      </div>`;

    const sluit = waarde => {
      laag.classList.remove("is-open");
      setTimeout(() => laag.remove(), 200);
      document.removeEventListener("keydown", opToets);
      klaar(waarde);
    };
    const opToets = e => { if (e.key === "Escape") sluit(null); };

    laag.addEventListener("click", e => {
      if (e.target === laag || e.target.closest("[data-sluit]")) return sluit(null);
      const knop = e.target.closest("[data-knop]");
      if (knop) {
        const k = knoppen[Number(knop.dataset.knop)];
        const waarde = k.waardeUit ? k.waardeUit(laag) : k.waarde;
        if (waarde === undefined) return;
        sluit(waarde);
      }
    });

    document.addEventListener("keydown", opToets);
    document.body.appendChild(laag);
    requestAnimationFrame(() => laag.classList.add("is-open"));
    opOpenen?.(laag, sluit);
  });
}

export async function bevestig(vraag, { titel = "Weet je het zeker?", bevestigLabel = "Ja", gevaar = false } = {}) {
  const uitkomst = await dialoog({
    titel,
    inhoud: `<p class="dialoog__vraag">${esc(vraag)}</p>`,
    knoppen: [
      { label: "Annuleren", waarde: false },
      { label: bevestigLabel, waarde: true, soort: gevaar ? "gevaar" : "primair" },
    ],
  });
  return uitkomst === true;
}

/* ---------------------------------------------------------------
   Bestanden
   --------------------------------------------------------------- */
export function downloadTekst(bestandsnaam, tekst, type = "application/json") {
  const blob = new Blob([tekst], { type: type + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function kiesBestand(accept = "application/json") {
  return new Promise(klaar => {
    const invoer = document.createElement("input");
    invoer.type = "file";
    invoer.accept = accept;
    invoer.onchange = () => klaar(invoer.files?.[0] || null);
    invoer.click();
  });
}

export const leesTekst = bestand => new Promise((klaar, mislukt) => {
  const lezer = new FileReader();
  lezer.onload = () => klaar(lezer.result);
  lezer.onerror = () => mislukt(lezer.error);
  /* Bankbestanden komen vaak nog in windows-1252 binnen; utf-8 lezen
     levert dan hooguit een raar teken op, geen crash. */
  lezer.readAsText(bestand, "utf-8");
});

/* ---------------------------------------------------------------
   Grafiekjes — inline SVG, geen bibliotheek
   --------------------------------------------------------------- */

/* Balkenlijst: leest op een telefoon prettiger dan een echte grafiek
   en werkt gewoon met een schermlezer. */
export function balken(items, { toonWaarde = v => geld(v), max = null } = {}) {
  const top = max ?? Math.max(...items.map(i => Math.abs(i.waarde)), 1);
  return `<ul class="balken">${items.map(i => `
    <li class="balk">
      <span class="balk__label">${i.icoon ? `<span class="balk__icoon">${esc(i.icoon)}</span>` : ""}${esc(i.label)}</span>
      <span class="balk__spoor">
        <span class="balk__vulling" style="width:${Math.min(100, (Math.abs(i.waarde) / top) * 100)}%;${i.kleur ? `background:${i.kleur}` : ""}"></span>
      </span>
      <span class="balk__waarde">${esc(toonWaarde(i.waarde))}</span>
    </li>`).join("")}</ul>`;
}

/* Ringdiagram voor verdelingen. */
export function ring(items, { grootte = 150, dikte = 20, midden = "" } = {}) {
  const zichtbaar = items.filter(i => i.waarde > 0);
  const totaal = zichtbaar.reduce((s, i) => s + i.waarde, 0);
  const straal = (grootte - dikte) / 2;
  const omtrek = 2 * Math.PI * straal;

  let segmenten = `<circle cx="${grootte / 2}" cy="${grootte / 2}" r="${straal}" fill="none"
                     stroke="var(--rand-zacht)" stroke-width="${dikte}"/>`;
  if (totaal > 0) {
    let verschoven = 0;
    segmenten += zichtbaar.map(i => {
      const lengte = (i.waarde / totaal) * omtrek;
      const cirkel = `<circle cx="${grootte / 2}" cy="${grootte / 2}" r="${straal}"
        fill="none" stroke="${i.kleur || "var(--accent)"}" stroke-width="${dikte}"
        stroke-dasharray="${lengte.toFixed(2)} ${(omtrek - lengte).toFixed(2)}"
        stroke-dashoffset="${(-verschoven).toFixed(2)}"
        transform="rotate(-90 ${grootte / 2} ${grootte / 2})"><title>${esc(i.label)}</title></circle>`;
      verschoven += lengte;
      return cirkel;
    }).join("");
  }

  return `<div class="ringhouder" style="width:${grootte}px;height:${grootte}px">
      <svg class="ring" viewBox="0 0 ${grootte} ${grootte}" width="${grootte}" height="${grootte}"
           role="img" aria-label="Verdeling">${segmenten}</svg>
      ${midden ? `<div class="ring__midden">${midden}</div>` : ""}
    </div>`;
}

/* Twee staven per maand: erin en eruit. De maandgrafiek van de app. */
export function maandStaven(maanden, { hoogte = 120, opActief = null } = {}) {
  const top = Math.max(...maanden.flatMap(m => [m.in, m.uit]), 1);
  return `<div class="staven" style="--staafhoogte:${hoogte}px">
    ${maanden.map(m => `
      <button class="staaf ${m.actief ? "is-actief" : ""}" data-maand="${esc(m.maand)}"
              aria-label="${esc(maandLabel(m.maand))}: ${geld(m.in, { altijdTonen: false })} erin, ${geld(m.uit)} eruit">
        <span class="staaf__paar">
          <span class="staaf__balk staaf__balk--in"  style="height:${(m.in / top) * 100}%"></span>
          <span class="staaf__balk staaf__balk--uit" style="height:${(m.uit / top) * 100}%"></span>
        </span>
        <span class="staaf__label">${esc(maandLabel(m.maand, { kort: true, jaar: false }).slice(0, 3))}</span>
      </button>`).join("")}
  </div>`;
}

/* Lijngrafiek voor het vermogensverloop. */
export function lijn(punten, { breedte = 320, hoogte = 96, kleur = "var(--accent)", vul = true } = {}) {
  if (punten.length < 2) return `<div class="grafiek-leeg">Nog te weinig maanden voor een lijn.</div>`;

  const waarden = punten.map(p => p.waarde);
  const max = Math.max(...waarden);
  const min = Math.min(...waarden, 0);
  const bereik = max - min || 1;

  const x = i => (i / (punten.length - 1)) * (breedte - 8) + 4;
  const y = w => hoogte - 8 - ((w - min) / bereik) * (hoogte - 20);

  const pad = punten.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.waarde).toFixed(1)}`).join(" ");
  const vulling = vul
    ? `<path d="${pad} L${x(punten.length - 1).toFixed(1)},${hoogte} L${x(0).toFixed(1)},${hoogte} Z"
         fill="${kleur}" opacity=".13"/>`
    : "";
  const laatste = punten[punten.length - 1];

  return `<svg class="lijngrafiek" viewBox="0 0 ${breedte} ${hoogte}" preserveAspectRatio="none"
            role="img" aria-label="Verloop">
      ${vulling}
      <path d="${pad}" fill="none" stroke="${kleur}" stroke-width="2.2"
            stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(punten.length - 1).toFixed(1)}" cy="${y(laatste.waarde).toFixed(1)}" r="3.2" fill="${kleur}"/>
    </svg>`;
}

/* Voortgangsbalk met een kleur die meebeweegt met hoe vol hij staat. */
export function voortgang(deel, geheel, { kleur = null, waarschuwVanaf = 0.9 } = {}) {
  const verhouding = geheel > 0 ? deel / geheel : 0;
  const breedte = Math.min(100, Math.max(0, verhouding * 100));
  const tint = kleur || (verhouding > 1 ? "var(--uitgave)" : verhouding >= waarschuwVanaf ? "var(--let-op)" : "var(--accent)");
  return `<span class="voortgang" role="img" aria-label="${procent(deel, geheel)} gebruikt">
      <span class="voortgang__vulling" style="width:${breedte}%;background:${tint}"></span>
    </span>`;
}
