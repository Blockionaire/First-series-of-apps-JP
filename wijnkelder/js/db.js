/* =====================================================================
   WIJNKELDER — lokale opslag
   =====================================================================
   Een dun laagje over IndexedDB. Bewust IndexedDB en niet localStorage:
   etiketfoto's tellen snel op en localStorage houdt het rond 5 MB voor
   gezien. IndexedDB heeft die grens niet, en slaat de foto's op als
   binaire blobs in plaats van als tekst.

   Alles wat de app opslaat gaat hier doorheen. Firestore is een kopie
   erbovenop, geen vervanging — de app werkt volledig zonder.
   ===================================================================== */

const DB_NAAM = "wijnkelder";
const DB_VERSIE = 1;

export const STORES = ["flessen", "notities", "historie", "wenslijst", "instellingen"];

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

export const dbAlles  = store        => transactie(store, "readonly",  s => s.getAll());
export const dbHaal   = (store, id)  => transactie(store, "readonly",  s => s.get(id));
export const dbZet    = (store, rec) => transactie(store, "readwrite", s => s.put(rec));
export const dbWis    = (store, id)  => transactie(store, "readwrite", s => s.delete(id));
export const dbLeeg   = store        => transactie(store, "readwrite", s => s.clear());

/* Meerdere records in één transactie — scheelt bij het binnenhalen van
   een volle kelder uit Firestore of uit een back-upbestand. */
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

/* Werkt de database niet (privémodus in sommige browsers), dan valt de
   app terug op geheugen. Je verliest dan alles bij het sluiten, maar de
   app blijft bruikbaar in plaats van dat hij op een wit scherm eindigt. */
export async function beschikbaar() {
  try { await open(); return true; }
  catch { return false; }
}
