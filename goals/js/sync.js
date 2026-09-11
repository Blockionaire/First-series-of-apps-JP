/* =====================================================================
   GOALS — account and synchronisation (optional)
   =====================================================================
   Without a Firebase configuration this file does nothing at all and
   the app runs entirely on the device. Fill in firebase-config.js and
   it adds two things: signing in, and keeping the same goals on your
   phone and your laptop.

   Everything lives under users/{uid}/… . The rules in firestore.rules
   are what actually protect it — the checks in this file are the
   polite front door, and they run in a browser you do not control.
   ===================================================================== */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

export const COLLECTIONS = [
  "periods", "goals", "milestones", "metrics", "standards", "entries",
  "weekly", "monthly", "topics", "modules", "resources", "notes", "backlog",
  "settings",
];

const config = (window.GOALS_CONFIG || {});

export const sync = {
  available: Boolean(config.firebase),
  requireAccount: Boolean(config.requireAccount),
  started: false,
  active: false,
  busy: false,
  error: null,
  user: null,          // { uid, email }
  status: "off",       // off | loading | signed-out | active | error
  lastPush: 0,
};

let FB = null;              // { auth, db, fns… }
let unsubscribes = [];
let onRemote = () => {};
let onStatus = () => {};
let localSnapshot = () => ({});
let queue = [];             // writes made before the SDK finished loading

export function init(hooks) {
  onRemote = hooks.onRemote || onRemote;
  onStatus = hooks.onStatus || onStatus;
  localSnapshot = hooks.localSnapshot || localSnapshot;

  if (!sync.available) { sync.status = "off"; return; }
  connect();
}

async function connect() {
  if (sync.started) return;
  sync.started = true;
  sync.status = "loading";
  onStatus();

  try {
    const [app, auth, store] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);

    const instance = app.initializeApp(config.firebase);
    FB = {
      auth: auth.getAuth(instance),
      db: store.getFirestore(instance),
      a: auth,
      f: store,
    };

    auth.onAuthStateChanged(FB.auth, user => {
      sync.user = user ? { uid: user.uid, email: user.email } : null;
      stopListening();
      if (user) startListening();
      else { sync.active = false; sync.status = "signed-out"; }
      onStatus();
    });
  } catch (e) {
    console.error(e);
    sync.status = "error";
    sync.error = "Could not reach Firebase.";
    onStatus();
  }
}

/* ---------------------------------------------------------------
   Signing in
   --------------------------------------------------------------- */
export async function signIn(email, password) {
  await connect();
  await FB.a.signInWithEmailAndPassword(FB.auth, email, password);
}

export async function register(email, password) {
  await connect();
  await FB.a.createUserWithEmailAndPassword(FB.auth, email, password);
  /* A brand new account starts empty, so everything on this device
     goes up once. */
  await pushAll();
}

export async function signOut() {
  if (FB) await FB.a.signOut(FB.auth);
}

export async function resetPassword(email) {
  await connect();
  await FB.a.sendPasswordResetEmail(FB.auth, email);
}

/* ---------------------------------------------------------------
   Listening
   --------------------------------------------------------------- */
function startListening() {
  const { f, db } = FB;
  const uid = sync.user.uid;

  unsubscribes = COLLECTIONS.map(name =>
    f.onSnapshot(
      f.collection(db, "users", uid, name),
      snapshot => {
        const records = snapshot.docs.map(d => d.data());
        if (records.length) onRemote(name, records);
        if (!sync.active) { sync.active = true; sync.status = "active"; onStatus(); }
      },
      error => {
        console.error(error);
        sync.error = error.message;
        sync.status = "error";
        onStatus();
      }));

  flush();
}

function stopListening() {
  unsubscribes.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  unsubscribes = [];
}

/* ---------------------------------------------------------------
   Writing
   --------------------------------------------------------------- */
export function push(collection, record) {
  if (!sync.available) return;
  if (!sync.user || !FB) { queue.push([collection, record]); return; }
  write(collection, record);
}

async function write(collection, record) {
  try {
    sync.busy = true;
    const { f, db } = FB;
    await f.setDoc(f.doc(db, "users", sync.user.uid, collection, record.id), clean(record));
    sync.lastPush = Date.now();
  } catch (e) {
    console.error(e);
    sync.error = e.message;
  } finally {
    sync.busy = false;
  }
}

function flush() {
  const pending = queue;
  queue = [];
  for (const [collection, record] of pending) write(collection, record);
}

/* Firestore refuses `undefined`, and a photo of a cover is fine but a
   function is not. */
function clean(record) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || typeof value === "function") continue;
    out[key] = value;
  }
  return out;
}

export async function pushAll() {
  if (!sync.user || !FB) return;
  const data = localSnapshot();
  const { f, db } = FB;
  let batch = f.writeBatch(db);
  let count = 0;

  for (const [collection, records] of Object.entries(data)) {
    if (!COLLECTIONS.includes(collection)) continue;
    for (const record of records) {
      batch.set(f.doc(db, "users", sync.user.uid, collection, record.id), clean(record));
      if (++count === 400) { await batch.commit(); batch = f.writeBatch(db); count = 0; }
    }
  }

  if (count) await batch.commit();
  sync.lastPush = Date.now();
}

/* Local-only devices may always write. With a cloud that demands an
   account, you get a read-only app until you sign in. */
export function canEdit() {
  if (!sync.available || !sync.requireAccount) return true;
  return Boolean(sync.user);
}

export const needsAccount = () => sync.available && sync.requireAccount && !sync.user;
