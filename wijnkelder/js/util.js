/* =====================================================================
   WIJNKELDER — gereedschap
   =====================================================================
   Kleine hulpjes die overal terugkomen: selecteren, opmaken, dialogen
   en het verkleinen van etiketfoto's.
   ===================================================================== */

/* ---------------------------------------------------------------
   DOM
   --------------------------------------------------------------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Alles wat uit de gegevens komt gaat hier doorheen voordat het in
   innerHTML belandt. Een producent die "Domaine <B> & Fils" heet mag
   de pagina niet slopen. */
export function esc(waarde) {
  if (waarde == null) return "";
  return String(waarde)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------------------------------------------------------------
   Opmaak
   --------------------------------------------------------------- */
let VALUTA = "EUR";
export const zetValuta = v => { VALUTA = v || "EUR"; };

export function geld(bedrag, { compact = false, leeg = "—" } = {}) {
  const n = Number(bedrag);
  if (!isFinite(n) || bedrag == null || bedrag === "") return leeg;
  if (compact && Math.abs(n) >= 10000) {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency", currency: VALUTA, notation: "compact", maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("nl-NL", {
    style: "currency", currency: VALUTA,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
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

const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni",
                 "juli", "augustus", "september", "oktober", "november", "december"];

export function datumNL(iso, { kort = false } = {}) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d)) return iso;
  if (kort) return `${d.getDate()} ${MAANDEN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  return `${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
}

export const vandaagISO = () => new Date().toISOString().slice(0, 10);

/* Zoeken zonder te struikelen over accenten: "chateau" vindt "Château". */
export const normaliseer = s =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

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
  }, soort === "fout" ? 5000 : 2800);
}

/* ---------------------------------------------------------------
   Dialoogvenster
   ---------------------------------------------------------------
   `inhoud` is HTML. `knoppen` is een lijst {label, waarde, soort}.
   De belofte lost op met de waarde van de ingedrukte knop, of null bij
   sluiten. Wie een formulier toont krijgt via `opOpenen` de kans om
   listeners te hangen.
   --------------------------------------------------------------- */
export function dialoog({ titel, inhoud, knoppen = [{ label: "Sluiten", waarde: null }], opOpenen, breed = false }) {
  return new Promise(klaar => {
    const laag = document.createElement("div");
    laag.className = "dialoog-laag";
    laag.innerHTML = `
      <div class="dialoog ${breed ? "dialoog--breed" : ""}" role="dialog" aria-modal="true" aria-label="${esc(titel)}">
        <header class="dialoog__kop">
          <h2>${esc(titel)}</h2>
          <button class="icoonknop" data-sluit aria-label="Sluiten">✕</button>
        </header>
        <div class="dialoog__inhoud">${inhoud}</div>
        <footer class="dialoog__voet">
          ${knoppen.map((k, i) => `
            <button class="knop ${k.soort ? "knop--" + k.soort : ""}" data-knop="${i}">${esc(k.label)}</button>
          `).join("")}
        </footer>
      </div>`;

    const sluit = waarde => {
      laag.classList.remove("is-open");
      setTimeout(() => laag.remove(), 180);
      document.removeEventListener("keydown", opToets);
      klaar(waarde);
    };
    const opToets = e => { if (e.key === "Escape") sluit(null); };

    laag.addEventListener("click", e => {
      if (e.target === laag || e.target.closest("[data-sluit]")) return sluit(null);
      const knop = e.target.closest("[data-knop]");
      if (knop) {
        const k = knoppen[Number(knop.dataset.knop)];
        /* Een knop mag zelf bepalen wat er teruggaat — bijvoorbeeld de
           ingevulde velden — en mag het sluiten tegenhouden. */
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
   Etiketfoto's
   ---------------------------------------------------------------
   Een foto uit een telefooncamera is zo 4 MB. Dat past niet in een
   Firestore-document (max 1 MB) en is voor een etiket ook nergens voor
   nodig. We schalen terug naar maximaal 1000 px en knijpen net zo lang
   in de kwaliteit tot het onder de 400 kB zit.
   --------------------------------------------------------------- */
export function verkleinFoto(bestand, { maxZijde = 1000, maxBytes = 400 * 1024 } = {}) {
  return new Promise((klaar, mislukt) => {
    const lezer = new FileReader();
    lezer.onerror = () => mislukt(new Error("Foto kon niet gelezen worden."));
    lezer.onload = () => {
      const img = new Image();
      img.onerror = () => mislukt(new Error("Dit lijkt geen afbeelding te zijn."));
      img.onload = () => {
        let { width: b, height: h } = img;
        const schaal = Math.min(1, maxZijde / Math.max(b, h));
        b = Math.round(b * schaal);
        h = Math.round(h * schaal);

        const doek = document.createElement("canvas");
        doek.width = b; doek.height = h;
        doek.getContext("2d").drawImage(img, 0, 0, b, h);

        let kwaliteit = 0.82;
        let uit = doek.toDataURL("image/jpeg", kwaliteit);
        while (uit.length * 0.75 > maxBytes && kwaliteit > 0.35) {
          kwaliteit -= 0.12;
          uit = doek.toDataURL("image/jpeg", kwaliteit);
        }
        klaar(uit);
      };
      img.src = lezer.result;
    };
    lezer.readAsDataURL(bestand);
  });
}

/* ---------------------------------------------------------------
   Bestand aanbieden — back-up downloaden
   --------------------------------------------------------------- */
export function downloadTekst(bestandsnaam, tekst, type = "application/json") {
  const blob = new Blob([tekst], { type });
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
  lezer.readAsText(bestand);
});

/* ---------------------------------------------------------------
   Kleine grafiekhulpjes — inline SVG, geen bibliotheek
   --------------------------------------------------------------- */

/* Een staafdiagram als lijst met balken; leest prettiger dan een echte
   grafiek op een telefoonscherm en werkt met een schermlezer. */
export function balken(items, { toonWaarde = v => getal(v) } = {}) {
  const max = Math.max(...items.map(i => i.waarde), 1);
  return `<ul class="balken">${items.map(i => `
    <li class="balk">
      <span class="balk__label">${esc(i.label)}</span>
      <span class="balk__spoor">
        <span class="balk__vulling" style="width:${(i.waarde / max) * 100}%;${i.kleur ? `background:${i.kleur}` : ""}"></span>
      </span>
      <span class="balk__waarde">${esc(toonWaarde(i.waarde))}</span>
    </li>`).join("")}</ul>`;
}

/* Ringdiagram voor verdelingen met weinig categorieën. */
export function ring(items, { grootte = 132, dikte = 18 } = {}) {
  const totaal = items.reduce((s, i) => s + i.waarde, 0);
  if (!totaal) return `<div class="ring ring--leeg" style="width:${grootte}px;height:${grootte}px"></div>`;

  const straal = (grootte - dikte) / 2;
  const omtrek = 2 * Math.PI * straal;
  let verschoven = 0;

  const segmenten = items.filter(i => i.waarde > 0).map(i => {
    const lengte = (i.waarde / totaal) * omtrek;
    const cirkel = `<circle cx="${grootte / 2}" cy="${grootte / 2}" r="${straal}"
      fill="none" stroke="${i.kleur}" stroke-width="${dikte}"
      stroke-dasharray="${lengte} ${omtrek - lengte}"
      stroke-dashoffset="${-verschoven}"
      transform="rotate(-90 ${grootte / 2} ${grootte / 2})"><title>${esc(i.label)}: ${i.waarde}</title></circle>`;
    verschoven += lengte;
    return cirkel;
  }).join("");

  return `<svg class="ring" viewBox="0 0 ${grootte} ${grootte}" width="${grootte}" height="${grootte}"
            role="img" aria-label="Verdeling">${segmenten}</svg>`;
}

/* Lijngrafiek voor de waardeontwikkeling en het drinktempo. */
export function lijn(punten, { breedte = 320, hoogte = 90, kleur = "var(--accent)", vul = true } = {}) {
  if (punten.length < 2) return `<div class="grafiek-leeg">Nog te weinig gegevens voor een grafiek.</div>`;

  const waarden = punten.map(p => p.waarde);
  const max = Math.max(...waarden);
  const min = Math.min(...waarden, 0);
  const bereik = max - min || 1;

  const x = i => (i / (punten.length - 1)) * (breedte - 8) + 4;
  const y = w => hoogte - 6 - ((w - min) / bereik) * (hoogte - 16);

  const pad = punten.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.waarde).toFixed(1)}`).join(" ");
  const vulling = vul
    ? `<path d="${pad} L${x(punten.length - 1).toFixed(1)},${hoogte} L${x(0).toFixed(1)},${hoogte} Z"
         fill="${kleur}" opacity=".14"/>`
    : "";

  return `<svg class="lijngrafiek" viewBox="0 0 ${breedte} ${hoogte}" preserveAspectRatio="none"
            role="img" aria-label="Verloop">
      ${vulling}
      <path d="${pad}" fill="none" stroke="${kleur}" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
}
