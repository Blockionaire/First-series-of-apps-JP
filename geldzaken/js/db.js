/* =====================================================================
   GELDZAKEN — lokale opslag
   =====================================================================
   Een dun laagje over IndexedDB. Alles wat de app opslaat gaat hier
   doorheen; Firestore is een kopie erbovenop, geen vervanging. Daardoor
   werkt de app volledig zonder internet en zonder account.

   IndexedDB in plaats van localStorage: een paar jaar transacties zijn
   zo tienduizenden regels, en localStorage houdt het rond de 5 MB voor
   gezien. Bovendien blokkeert localStorage de pagina bij elk schrijfje.
   ===================================================================== */

const DB_NAAM = "geldzaken";
const DB_VERSIE = 1;

export const STORES = [
  "transacties",   // losse boekingen (inkomsten, uitgaven, sparen, overboekingen)
  "terugkerend",   // vaste lasten en vast inkomen
  "potjes",        // enveloppen waar je maandelijks in stort
  "doelen",        // spaardoelen met een streefbedrag
  "rekeningen",    // betaal-, spaar- en beleggingsrekeningen
  "categorieen",   // eigen categorieën met budget
  "regels",        // omschrijving → categorie, voor het inlezen van bankbestanden
  "instellingen",  // één document met de voorkeuren
];

let dbBelofte = null;

function open() {
  if (dbBelofte) return dbBelofte;

  dbBelofte = new Promise((klaar, mislukt) => {
    const verzoek = indexedDB.open(DB_NAAM, DB_VERSIE);

    verzoek.onupgradeneeded = () => {
      const db = verzoek.result;
      for (const naam of STORES) {
        if (!db.objectStoreNames.contains(naam)) {
          db.createObjectStore(naam, { keyPath: "id" });
        }
      }
    };

    verzoek.onsuccess = () => klaar(verzoek.result);
    verzoek.onerror = () => mislukt(verzoek.error);
    verzoek.onblocked = () => mislukt(new Error("Database geblokkeerd door een ander tabblad."));
  });

  return dbBelofte;
}

function transactie(store, modus, werk) {
  return open().then(db => new Promise((klaar, mislukt) => {
    const tx = db.transaction(store, modus);
    const verzoek = werk(tx.objectStore(store));
    tx.oncomplete = () => klaar(verzoek ? verzoek.result : undefined);
    tx.onerror = () => mislukt(tx.error);
    tx.onabort = () => mislukt(tx.error);
  }));
}

export const dbAlles = store        => transactie(store, "readonly",  s => s.getAll());
export const dbHaal  = (store, id)  => transactie(store, "readonly",  s => s.get(id));
export const dbZet   = (store, rec) => transactie(store, "readwrite", s => s.put(rec));
export const dbWis   = (store, id)  => transactie(store, "readwrite", s => s.delete(id));
export const dbLeeg  = store        => transactie(store, "readwrite", s => s.clear());

/* Meerdere records in één transactie — scheelt flink bij het inlezen
   van een bankbestand of het binnenhalen van een volle cloud. */
export function dbZetVeel(store, records) {
  if (!records.length) return Promise.resolve();
  return open().then(db => new Promise((klaar, mislukt) => {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    for (const r of records) s.put(r);
    tx.oncomplete = klaar;
    tx.onerror = () => mislukt(tx.error);
  }));
}

export function dbWisVeel(store, ids) {
  if (!ids.length) return Promise.resolve();
  return open().then(db => new Promise((klaar, mislukt) => {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    for (const id of ids) s.delete(id);
    tx.oncomplete = klaar;
    tx.onerror = () => mislukt(tx.error);
  }));
}

/* Werkt de database niet — privémodus in sommige browsers — dan valt de
   app terug op geheugen. Je verliest dan alles bij het sluiten, maar de
   app blijft bruikbaar in plaats van op een wit scherm te eindigen. */
export async function beschikbaar() {
  try { await open(); return true; }
  catch { return false; }
}
