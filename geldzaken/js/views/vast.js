/* =====================================================================
   GELDZAKEN — vaste lasten en vast inkomen
   =====================================================================
   Alles wat elke maand (of elk kwartaal, of elk jaar) terugkomt. De app
   zet die posten vooruit in de kalender, zodat het startscherm kan
   zeggen wat er nog moet komen.

   Eén ding is hier belangrijker dan het lijkt: kwartaal- en
   jaarrekeningen. Die komen altijd op een verkeerd moment. Daarom
   rekent dit scherm uit wat ze per maand kosten, zodat je dat bedrag
   opzij kunt zetten in plaats van te schrikken in januari.
   ===================================================================== */

import { esc, geld, maandLabel, maandPlus, maandNu, datumNL,
         relatieveDatum, melding, bevestig, dialoog, leesBedrag } from "../util.js";
import { state, legePost, bewaarPost, wisPost, boekVasteLast,
         wisTransactie, meld } from "../store.js";
import { vasteLastenVanMaand, perMaand, RITMES, vasteLastenPerMaand,
         vastInkomenPerMaand, reserveringPerMaand } from "../bereken.js";
import { maandkiezer, koppelMaandkiezer, leeg, categorieOpties,
         rekeningOpties, persoonOpties } from "./onderdelen.js";
import { eisBewerkrecht } from "../app.js";

export const titel = () => "Vaste lasten";
export const ondertitel = () => maandLabel(state.maand);
export const terugknop = true;

export const kopActies = () => `<button class="icoonknop" data-nieuw aria-label="Nieuwe vaste last">＋</button>`;

/* ---------------------------------------------------------------
   Tekenen
   --------------------------------------------------------------- */
export function html() {
  const maand = state.maand;
  const posten = vasteLastenVanMaand(state, maand);
  const uitgaven = posten.filter(p => p.soort !== "inkomst");
  const inkomsten = posten.filter(p => p.soort === "inkomst");

  const perMaandUit = vasteLastenPerMaand(state);
  const perMaandIn = vastInkomenPerMaand(state);
  const reservering = reserveringPerMaand(state);

  const betaald = uitgaven.filter(p => p.betaald).reduce((s, p) => s + p.bedrag, 0);
  const teGaan = uitgaven.filter(p => !p.betaald).reduce((s, p) => s + p.verwacht, 0);

  return `
    <div style="display:flex;justify-content:center;margin-bottom:14px">
      ${maandkiezer(maand, { maxMaand: maandPlus(maandNu(), 12) })}
    </div>

    <div class="cijferrij cijferrij--twee">
      <div class="cijfer">
        <div class="cijfer__waarde">${geld(betaald)}</div>
        <div class="cijfer__label">Al afgeschreven</div>
      </div>
      <div class="cijfer">
        <div class="cijfer__waarde" style="color:${teGaan > 0 ? "var(--let-op)" : "var(--goed)"}">${geld(teGaan)}</div>
        <div class="cijfer__label">Moet nog</div>
      </div>
    </div>

    <div class="kaart">
      <div class="kaart__kop"><h2>Gemiddeld per maand</h2></div>
      <div style="display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:7px">
        <span>Vaste lasten</span><span class="bedrag af">${geld(perMaandUit)}</span>
      </div>
      ${perMaandIn > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:7px">
          <span>Vast inkomen</span><span class="bedrag op">${geld(perMaandIn)}</span>
        </div>` : ""}
      ${reservering.totaal > 0 ? `
        <div class="kaart__voet">
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span>Opzij voor kwartaal- en jaarrekeningen</span>
            <span class="bedrag" style="color:var(--potje)">${geld(reservering.totaal)}</span>
          </div>
          <div class="veld__hint">
            ${reservering.posten.length} ${reservering.posten.length === 1 ? "post komt" : "posten komen"} niet elke maand.
            Zet dit bedrag maandelijks in een potje, dan schrik je nooit van zo'n rekening.
          </div>
          <button class="knop knop--klein knop--rand" data-reserveerpotje style="margin-top:10px">Maak hier een potje voor</button>
        </div>` : ""}
    </div>

    ${blok("Deze maand", uitgaven)}
    ${inkomsten.length ? blok("Vast inkomen", inkomsten) : ""}
    ${alleLijst()}

    <button class="knop knop--primair knop--breed" data-nieuw style="margin-top:16px">Vaste last toevoegen</button>`;
}

function blok(kop, posten) {
  if (!posten.length) {
    return `
      <div class="sectiekop"><h2>${esc(kop)}</h2></div>
      ${leeg({ icoon: "🔁", titel: "Nog geen vaste posten", tekst: "Huur, energie, verzekeringen, abonnementen — zet ze er één keer in en de app rekent de rest uit." })}`;
  }

  return `
    <div class="sectiekop"><h2>${esc(kop)}</h2></div>
    <div class="lijst">
      ${posten.map(p => {
        const cat = state.categorieen.find(c => c.id === p.categorie);
        const telaat = !p.betaald && p.dagenTot < 0;
        const inkomst = p.soort === "inkomst";
        return `
          <div class="rij">
            <span class="rij__icoon" style="${cat ? `background:color-mix(in srgb, ${cat.kleur} 18%, var(--vlak-diep))` : ""}">${esc(cat?.icoon || "🔁")}</span>
            <span class="rij__midden" data-bewerk="${esc(p.id)}" style="cursor:pointer">
              <span class="rij__titel">${esc(p.naam)}</span>
              <span class="rij__sub">
                ${esc(datumNL(p.datum, { kort: true, metJaar: false }))}
                ${p.post.ritme !== "maand" ? ` · ${esc(RITMES[p.post.ritme]?.label || "")}` : ""}
                ${p.betaald ? (p.herkend ? " · herkend uit je boekingen" : " · afgevinkt") : ` · ${esc(relatieveDatum(p.datum))}`}
              </span>
            </span>
            <span class="rij__rechts">
              <span class="rij__bedrag ${inkomst ? "op" : ""}">${geld(p.bedrag)}</span>
              ${telaat ? `<span class="rij__bij" style="color:var(--fout)">${inkomst ? "nog niet binnen" : "te laat"}</span>` : ""}
            </span>
            ${p.betaald
              ? `<button class="icoonknop" data-ontvink="${esc(p.transactie.id)}" data-naam="${esc(p.naam)}"
                         aria-label="Boeking bekijken" title="${p.herkend ? "Herkend uit je boekingen" : "Afgevinkt"}">✓</button>`
              : `<button class="knop knop--klein" data-afvink="${esc(p.id)}" data-datum="${esc(p.datum)}">Afvinken</button>`}
          </div>`;
      }).join("")}
    </div>`;
}

/* Alle posten, ook die deze maand niet langskomen. */
function alleLijst() {
  if (!state.terugkerend.length) return "";
  return `
    <details class="uitklap" style="margin-top:18px">
      <summary>Alle vaste posten (${state.terugkerend.length})</summary>
      <div>
        ${state.terugkerend
          .slice()
          .sort((a, b) => (b.soort === "inkomst") - (a.soort === "inkomst") || a.naam.localeCompare(b.naam))
          .map(p => `
            <div class="rij rij--vlak" data-bewerk="${esc(p.id)}" style="cursor:pointer">
              <span class="rij__midden">
                <span class="rij__titel">${esc(p.naam)} ${p.actief === false ? `<span class="label">uit</span>` : ""}</span>
                <span class="rij__sub">${esc(RITMES[p.ritme]?.label || "per maand")} · dag ${esc(String(p.dag || 1))}
                  ${p.ritme !== "maand" ? ` · ${geld(perMaand(p))} per maand` : ""}</span>
              </span>
              <span class="rij__rechts">
                <span class="rij__bedrag ${p.soort === "inkomst" ? "op" : ""}">${geld(p.bedrag)}</span>
              </span>
            </div>`).join("")}
      </div>
    </details>`;
}

/* ---------------------------------------------------------------
   Koppelen
   --------------------------------------------------------------- */
export function koppel(wortel) {
  koppelMaandkiezer(wortel, stap => { state.maand = maandPlus(state.maand, stap); meld(); });

  document.querySelector(".kop [data-nieuw]")?.addEventListener("click", () => bewerkPost(null));

  wortel.addEventListener("click", async e => {
    if (e.target.closest("[data-nieuw]")) return bewerkPost(null);

    const bewerk = e.target.closest("[data-bewerk]");
    if (bewerk) return bewerkPost(state.terugkerend.find(p => p.id === bewerk.dataset.bewerk));

    const afvink = e.target.closest("[data-afvink]");
    if (afvink) {
      if (!eisBewerkrecht()) return;
      const post = state.terugkerend.find(p => p.id === afvink.dataset.afvink);
      if (!post) return;
      await boekVasteLast(post, { datum: afvink.dataset.datum });
      melding(`${post.naam} afgevinkt.`, "goed");
      return;
    }

    const ontvink = e.target.closest("[data-ontvink]");
    if (ontvink) {
      if (!eisBewerkrecht()) return;
      const zeker = await bevestig(
        `De boeking die de app bij "${ontvink.dataset.naam}" laat horen wordt verwijderd. Klopte die boeking wel, maar hoort hij ergens anders bij? Pas hem dan aan bij je boekingen.`,
        { titel: "Boeking verwijderen", bevestigLabel: "Verwijderen", gevaar: true });
      if (!zeker) return;
      await wisTransactie(ontvink.dataset.ontvink);
      melding("Boeking verwijderd.");
      return;
    }

    if (e.target.closest("[data-reserveerpotje]")) return maakReservePotje();
  });
}

/* ---------------------------------------------------------------
   Post toevoegen of aanpassen
   --------------------------------------------------------------- */
async function bewerkPost(bestaand) {
  if (!eisBewerkrecht()) return;
  const p = bestaand ? { ...bestaand } : legePost();
  const nieuw = !bestaand;

  const uitkomst = await dialoog({
    titel: nieuw ? "Nieuwe vaste post" : p.naam,
    onderaan: true,
    inhoud: `
      <div class="segment">
        <button type="button" data-soort="uitgave" aria-pressed="${p.soort !== "inkomst"}">Vaste last</button>
        <button type="button" data-soort="inkomst" aria-pressed="${p.soort === "inkomst"}">Vast inkomen</button>
      </div>
      <div class="veld">
        <label for="pnaam">Naam</label>
        <input type="text" id="pnaam" value="${esc(p.naam)}" placeholder="Huur, energie, Netflix…">
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="pbedrag">Bedrag</label>
          <input type="text" id="pbedrag" inputmode="decimal" value="${p.bedrag ? String(p.bedrag).replace(".", ",") : ""}" placeholder="0,00">
        </div>
        <div class="veld">
          <label for="pritme">Hoe vaak</label>
          <select id="pritme">
            ${Object.entries(RITMES).map(([id, r]) =>
              `<option value="${id}" ${p.ritme === id ? "selected" : ""}>${esc(r.label)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="veldrij">
        <div class="veld">
          <label for="pdag">Op welke dag</label>
          <input type="number" id="pdag" min="1" max="31" value="${Number(p.dag) || 1}">
        </div>
        <div class="veld">
          <label for="pstart">Vanaf</label>
          <input type="month" id="pstart" value="${esc(p.startMaand || maandNu())}">
        </div>
      </div>
      <div class="veld">
        <label for="pcategorie">Categorie</label>
        <select id="pcategorie">${categorieOpties(p.categorie, p.soort === "inkomst" ? "inkomst" : "uitgave")}</select>
      </div>
      <div class="veld">
        <label for="prekening">Rekening</label>
        <select id="prekening">${rekeningOpties(p.rekening)}</select>
      </div>
      ${(state.instellingen.personen || []).length ? `
        <div class="veld">
          <label for="ppersoon">Van wie</label>
          <select id="ppersoon">${persoonOpties(p.persoon)}</select>
        </div>` : ""}
      <div class="schakelrij">
        <span class="schakelrij__tekst">
          <span class="schakelrij__titel">Actief</span>
          <span class="schakelrij__uitleg">Zet uit als de post gestopt is, dan blijft de geschiedenis wel staan.</span>
        </span>
        <label class="schakelaar">
          <input type="checkbox" id="pactief" ${p.actief !== false ? "checked" : ""}>
          <span class="schakelaar__spoor"></span>
        </label>
      </div>
      ${nieuw ? "" : `<button class="knop knop--rand knop--breed" data-verwijder style="margin-top:12px">Verwijderen</button>`}`,
    knoppen: [
      { label: "Annuleren", waarde: null },
      {
        label: "Opslaan", soort: "primair",
        waardeUit: laag => {
          const v = id => laag.querySelector("#" + id);
          const naam = v("pnaam").value.trim();
          const bedrag = leesBedrag(v("pbedrag").value);
          if (!naam) { melding("Geef de post een naam.", "fout"); return undefined; }
          if (!bedrag) { melding("Vul een bedrag in.", "fout"); return undefined; }
          return {
            ...p,
            naam,
            bedrag,
            soort: laag.querySelector("[data-soort][aria-pressed=true]")?.dataset.soort || "uitgave",
            ritme: v("pritme").value,
            dag: Math.min(31, Math.max(1, Number(v("pdag").value) || 1)),
            startMaand: v("pstart").value || maandNu(),
            categorie: v("pcategorie").value,
            rekening: v("prekening").value,
            persoon: v("ppersoon")?.value || "",
            actief: v("pactief").checked,
          };
        },
      },
    ],
    opOpenen: (laag, sluit) => {
      laag.querySelectorAll("[data-soort]").forEach(knop => {
        knop.addEventListener("click", () => {
          laag.querySelectorAll("[data-soort]").forEach(k => k.setAttribute("aria-pressed", String(k === knop)));
          /* De categorielijst hoort bij het soort. */
          laag.querySelector("#pcategorie").innerHTML = categorieOpties(
            laag.querySelector("#pcategorie").value,
            knop.dataset.soort === "inkomst" ? "inkomst" : "uitgave");
        });
      });

      laag.querySelector("[data-verwijder]")?.addEventListener("click", async () => {
        const zeker = await bevestig(`"${p.naam}" verdwijnt uit je vaste lasten. Al geboekte bedragen blijven staan.`,
          { bevestigLabel: "Verwijderen", gevaar: true });
        if (!zeker) return;
        await wisPost(p.id);
        melding("Vaste post verwijderd.");
        sluit(null);
      });

      if (!p.naam) setTimeout(() => laag.querySelector("#pnaam")?.focus(), 60);
    },
  });

  if (!uitkomst) return;
  await bewaarPost(uitkomst);
  melding(nieuw ? "Vaste post toegevoegd." : "Opgeslagen.", "goed");
}

/* Een potje maken dat precies de kwartaal- en jaarrekeningen opvangt. */
async function maakReservePotje() {
  if (!eisBewerkrecht()) return;
  const { totaal, posten } = reserveringPerMaand(state);
  const bestaat = state.potjes.find(p => p.naam === "Jaarrekeningen");

  /* Had je dat potje zelf in onderdelen verdeeld, dan is het maandbedrag
     de som daarvan. Dit bedrag zetten we er dus alleen in als we die
     verdeling loslaten — en dat vragen we eerst. */
  const heeftDelen = (bestaat?.subpotjes || []).length > 0;
  const zeker = await bevestig(
    `Er komt een potje "Jaarrekeningen" met ${geld(Math.ceil(totaal))} per maand, genoeg voor ${posten.length} ${posten.length === 1 ? "post" : "posten"}.` +
    (heeftDelen ? ` De ${bestaat.subpotjes.length} onderdelen die er nu in staan vervallen daarmee.` : ""),
    { titel: bestaat ? "Potje bijwerken" : "Potje aanmaken", bevestigLabel: bestaat ? "Bijwerken" : "Aanmaken" });
  if (!zeker) return;

  const { legPotje, bewaarPotje } = await import("../store.js");
  const potje = bestaat
    ? { ...bestaat, subpotjes: [], maandelijks: Math.ceil(totaal) }
    : legPotje({ naam: "Jaarrekeningen", icoon: "🧾", kleur: "#f5a524", maandelijks: Math.ceil(totaal) });
  await bewaarPotje(potje);
  melding("Potje klaargezet.", "goed");
}
