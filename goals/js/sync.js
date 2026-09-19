/* =====================================================================
   GOALS — account and synchronisation (optional)
   =====================================================================
   Without a Supabase configuration this file does nothing at all and
   the app runs entirely on the device. Fill in supabase-config.js and
   it adds two things: signing in, and keeping the same goals on your
   phone and your laptop.

   No SDK. Supabase is a Postgres database with an HTTP front door, and
   the app needs four things from it: sign in, sign up, read the rows
   that changed, write the rows that changed. That is plain fetch, and
   it keeps this app what it has been all along — one folder of files
   with no build step and nothing loaded from a CDN.

   Everything lives in one table, `goals_records`, one row per document
   — prefixed, because the project may hold other apps too:

       user_id | collection | id | data (jsonb) | updated | deleted

   which is the shape the app already stores locally. The rules that
   protect it are the row-level security policies in supabase.sql, and
   those run at Supabase. The checks in this file are the polite front
   door, and they run in a browser you do not control.
   ===================================================================== */

export const COLLECTIONS = [
  "periods", "goals", "milestones", "metrics", "standards", "entries",
  "weekly", "monthly", "topics", "modules", "resources", "notes", "backlog",
  "settings",
];

const config = window.GOALS_CONFIG || {};
const project = config.supabase || null;

const URL_BASE = project ? String(project.url || "").replace(/\/+$/, "") : "";
const KEY = project ? project.anonKey || "" : "";

/* How often to look for changes from your other device while the app
   is open and in front of you. Every write pushes immediately, so this
   is only about hearing the other direction. */
const POLL_MS = Number(config.pollSeconds || 45) * 1000;

const SESSION_KEY = "goals.session";

export const sync = {
  available: Boolean(URL_BASE && KEY),
  requireAccount: Boolean(config.requireAccount),
  started: false,
  active: false,
  busy: false,
  error: null,
  user: null,          // { id, email }
  status: "off",       // off | loading | signed-out | active | error
  lastPush: 0,
  lastPull: 0,
};

let session = null;        // { access_token, refresh_token, expires_at, user }
let onRemote = () => {};
let onStatus = () => {};
let localSnapshot = () => ({});
let beforeFirstPull = async () => false;
let queue = [];            // writes made before sign-in
let timer = null;
let watermark = 0;         // the newest `updated` we have already seen

/* ---------------------------------------------------------------
   Starting up
   --------------------------------------------------------------- */
export function init(hooks) {
  onRemote = hooks.onRemote || onRemote;
  onStatus = hooks.onStatus || onStatus;
  localSnapshot = hooks.localSnapshot || localSnapshot;
  beforeFirstPull = hooks.beforeFirstPull || beforeFirstPull;

  if (!sync.available) { sync.status = "off"; return; }

  sync.started = true;
  session = readSession();

  if (!session) {
    sync.status = "signed-out";
    onStatus();
    return;
  }

  sync.user = session.user;
  sync.status = "loading";
  onStatus();
  begin();
}

/* Pull what changed, push what we have, then keep an ear open. */
async function begin() {
  try {
    await pull({ full: true });
    await pushAll();
    sync.active = true;
    sync.status = "active";
    flush();
  } catch (error) {
    fail(error);
  }
  onStatus();
  listen();
}

function listen() {
  clearInterval(timer);
  if (!session) return;

  timer = setInterval(() => {
    if (document.visibilityState === "visible") pull().catch(fail);
  }, POLL_MS);

  /* Coming back to the app is the moment you most want it current. */
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", onWake);
}

function onWake() {
  if (document.visibilityState === "visible" && session) pull().catch(fail);
}

function stop() {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", onWake);
  window.removeEventListener("online", onWake);
}

/* ---------------------------------------------------------------
   Talking to Supabase
   --------------------------------------------------------------- */
async function request(path, { method = "GET", body = null, headers = {}, auth = true, retry = true } = {}) {
  if (auth && session && expired(session)) await refresh();

  const response = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: KEY,
      "Content-Type": "application/json",
      ...(auth && session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...headers,
    },
    body: body === null ? undefined : JSON.stringify(body),
  });

  /* A token can expire between the check and the call. One retry. */
  if (response.status === 401 && auth && retry && session) {
    await refresh();
    return request(path, { method, body, headers, auth, retry: false });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(readable(response.status, detail));
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const expired = s => !s.expires_at || Date.now() > s.expires_at - 60_000;

async function refresh() {
  const current = session;
  if (!current || !current.refresh_token) return;
  session = null;                                   // avoid recursing through request()

  const data = await request(`/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    body: { refresh_token: current.refresh_token },
    auth: false,
  }).catch(() => null);

  if (!data || !data.access_token) {
    /* The refresh token is gone or rejected — back to the sign-in screen
       rather than a silent, endless retry. */
    forget();
    sync.status = "signed-out";
    onStatus();
    throw new Error("Your session expired. Sign in again.");
  }

  keep(data);
}

/* ---------------------------------------------------------------
   Signing in
   --------------------------------------------------------------- */
export async function signIn(email, password) {
  const data = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  keep(data);
  await begin();
}

export async function register(email, password) {
  const data = await request("/auth/v1/signup", {
    method: "POST",
    body: { email, password },
    auth: false,
  });

  /* With email confirmation switched on, signup returns a user but no
     session. Nothing to sync until they confirm and sign in. */
  if (!data || !data.access_token) {
    throw new Error("Account created. Confirm your email address, then sign in.");
  }

  keep(data);
  await begin();
}

export async function resetPassword(email) {
  await request("/auth/v1/recover", { method: "POST", body: { email }, auth: false });
}

export async function signOut() {
  try {
    if (session) await request("/auth/v1/logout", { method: "POST", body: {}, retry: false });
  } catch (e) {
    console.warn("Sign-out call failed; forgetting the session anyway.", e);
  }
  forget();
  sync.status = "signed-out";
  onStatus();
}

function keep(data) {
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user ? { id: data.user.id, email: data.user.email } : (session && session.user) || null,
  };
  sync.user = session.user;
  sync.error = null;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn("Could not remember the session on this device.", e);
  }
}

function forget() {
  stop();
  session = null;
  sync.user = null;
  sync.active = false;
  watermark = 0;
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { console.warn(e); }
}

function readSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return stored && stored.refresh_token ? stored : null;
  } catch (e) {
    console.warn(e);
    return null;
  }
}

/* ---------------------------------------------------------------
   Reading
   ---------------------------------------------------------------
   Only what changed since last time. The first pull after signing in
   asks for everything.
   --------------------------------------------------------------- */
export async function pull({ full = false } = {}) {
  if (!session) return;

  const since = full ? 0 : watermark;
  const rows = await request(
    `/rest/v1/goals_records?select=collection,id,data,updated,deleted` +
    `&updated=gt.${since}&order=updated.asc&limit=10000`);

  sync.lastPull = Date.now();
  if (!rows || !rows.length) return;

  /* A device that has never been used hands itself over to the cloud
     rather than adding its own seed to yours. */
  if (full) await beforeFirstPull(rows.filter(row => !row.deleted).length);

  /* Grouped per collection, because that is how the store applies
     them — and it applies last-write-wins itself, so a row that is
     older than what is on this device changes nothing. */
  const byCollection = new Map();
  for (const row of rows) {
    if (!COLLECTIONS.includes(row.collection)) continue;
    const record = { ...(row.data || {}), id: row.id, updated: row.updated };
    if (row.deleted) record.deleted = true;
    if (!byCollection.has(row.collection)) byCollection.set(row.collection, []);
    byCollection.get(row.collection).push(record);
    if (row.updated > watermark) watermark = row.updated;
  }

  for (const [collection, records] of byCollection) onRemote(collection, records);
}

/* ---------------------------------------------------------------
   Writing
   --------------------------------------------------------------- */
export function push(collection, record) {
  if (!sync.available) return;
  if (!session) { queue.push([collection, record]); return; }
  write([[collection, record]]).catch(fail);
}

async function write(pairs) {
  if (!session || !pairs.length) return;
  sync.busy = true;
  onStatus();

  try {
    const rows = pairs.map(([collection, record]) => ({
      user_id: session.user.id,
      collection,
      id: record.id,
      data: record,
      updated: record.updated || Date.now(),
      deleted: Boolean(record.deleted),
    }));

    await request("/rest/v1/goals_records", {
      method: "POST",
      body: rows,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });

    sync.lastPush = Date.now();
    sync.error = null;
    for (const row of rows) if (row.updated > watermark) watermark = row.updated;
  } finally {
    sync.busy = false;
    onStatus();
  }
}

/* Everything on this device, in chunks Postgres will not choke on. */
export async function pushAll() {
  if (!session) return;
  const data = localSnapshot();
  const pairs = [];

  for (const [collection, records] of Object.entries(data)) {
    if (!COLLECTIONS.includes(collection)) continue;
    for (const record of records) pairs.push([collection, record]);
  }

  for (let i = 0; i < pairs.length; i += 200) {
    await write(pairs.slice(i, i + 200));
  }
}

function flush() {
  const pending = queue;
  queue = [];
  if (pending.length) write(pending).catch(fail);
}

function fail(error) {
  console.error(error);
  sync.error = error.message || String(error);
  if (sync.status !== "signed-out") sync.status = "error";
  onStatus();
}

/* Supabase answers in JSON; people do not read JSON. */
function readable(status, detail) {
  let message = "";
  try {
    const body = JSON.parse(detail);
    message = String(body.msg || body.message || body.error_description || "").toLowerCase();
  } catch {
    message = "";
  }

  if (status === 400 && message.includes("invalid login")) return "That email and password do not match.";
  if (status === 400 && message.includes("already registered")) return "There is already an account with that email.";
  if (status === 422 && message.includes("password")) return "Pick a password of at least six characters.";
  if (status === 400 && message.includes("email")) return "That does not look like an email address.";
  if (status === 401) return "Not signed in.";
  if (status === 404) return "The goals_records table is missing — run supabase.sql in the SQL editor.";
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status >= 500) return "Supabase is not answering right now.";
  return `Something went wrong (${status}).`;
}

/* Local-only devices may always write. With a cloud that demands an
   account, you get a read-only app until you sign in. */
export function canEdit() {
  if (!sync.available || !sync.requireAccount) return true;
  return Boolean(session);
}

export const needsAccount = () => sync.available && sync.requireAccount && !session;
