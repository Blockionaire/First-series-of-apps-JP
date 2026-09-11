/* =====================================================================
   GOALS — local storage
   =====================================================================
   A thin layer over IndexedDB. Everything the app saves goes through
   here; Firestore is a copy on top, never a replacement. That is what
   makes the app work offline, on a plane, and without an account.

   IndexedDB rather than localStorage: topic covers are photos, and
   localStorage calls it a day around 5 MB. It also blocks the page on
   every write, which you feel when logging should take two seconds.
   ===================================================================== */

const DB_NAME = "goals";
const DB_VERSION = 1;

export const STORES = [
  "periods",    // goal periods (Sept–Dec 2026, Q1 2027, …)
  "goals",      // the goals inside a period
  "milestones", // outcomes to reach, usually per month
  "metrics",    // what gets measured on a goal
  "standards",  // recurring behaviour to maintain
  "entries",    // every log: weight, gym, hours, revenue, study, learning
  "weekly",     // weekly reviews
  "monthly",    // monthly reviews
  "topics",     // curiosity topics
  "modules",    // learning modules inside a topic
  "resources",  // links, books, videos
  "notes",      // free notes on a goal, topic or module
  "backlog",    // curiosity backlog
  "settings",   // one document with the preferences
];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((done, fail) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => done(request.result);
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error("Database blocked by another tab."));
  });

  return dbPromise;
}

function transaction(store, mode, work) {
  return open().then(db => new Promise((done, fail) => {
    const tx = db.transaction(store, mode);
    const request = work(tx.objectStore(store));
    tx.oncomplete = () => done(request ? request.result : undefined);
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error);
  }));
}

export const dbAll   = store       => transaction(store, "readonly",  s => s.getAll());
export const dbGet   = (store, id) => transaction(store, "readonly",  s => s.get(id));
export const dbPut   = (store, rec) => transaction(store, "readwrite", s => s.put(rec));
export const dbDel   = (store, id) => transaction(store, "readwrite", s => s.delete(id));
export const dbClear = store       => transaction(store, "readwrite", s => s.clear());

/* Several records in one transaction — matters when seeding or when a
   full cloud snapshot comes down. */
export function dbPutMany(store, records) {
  if (!records.length) return Promise.resolve();
  return open().then(db => new Promise((done, fail) => {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    for (const r of records) s.put(r);
    tx.oncomplete = done;
    tx.onerror = () => fail(tx.error);
  }));
}

export function dbDelMany(store, ids) {
  if (!ids.length) return Promise.resolve();
  return open().then(db => new Promise((done, fail) => {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    for (const id of ids) s.delete(id);
    tx.oncomplete = done;
    tx.onerror = () => fail(tx.error);
  }));
}

/* Private mode on some browsers hands you an IndexedDB that throws on
   first use. Better to find out at startup than halfway through a log. */
export async function available() {
  try {
    await open();
    return true;
  } catch (e) {
    console.warn("IndexedDB unavailable — running in memory only.", e);
    return false;
  }
}
