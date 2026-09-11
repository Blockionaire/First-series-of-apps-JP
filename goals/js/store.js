/* =====================================================================
   GOALS — the data
   =====================================================================
   Everything the app knows lives in `state`, and every change goes
   through this file. Views read `state` and call these functions; they
   never touch the database or Firestore themselves.

   Order of every change: the screen first, then the local database,
   then the cloud. That way logging a workout never waits on a network.

   Deletes leave a tombstone behind ({ id, deleted: true }). Without it
   a second device would happily restore what you just removed.
   ===================================================================== */

import { dbAll, dbPut, dbPutMany, dbClear, available, STORES } from "./db.js";
import * as Sync from "./sync.js";
import { seedData } from "./data/seed.js";
import { newId, now, todayISO, weekStart, monthOf, normalise } from "./util.js";

export { Sync };

/* The collections that hold records. `settings` is one document and is
   handled apart. */
export const COLLECTIONS = [
  "periods", "goals", "milestones", "metrics", "standards", "entries",
  "weekly", "monthly", "topics", "modules", "resources", "notes", "backlog",
];

export const state = {
  loaded: false,
  storageWorks: true,

  periods: [],
  goals: [],
  milestones: [],
  metrics: [],
  standards: [],
  entries: [],
  weekly: [],
  monthly: [],
  topics: [],
  modules: [],
  resources: [],
  notes: [],
  backlog: [],

  settings: {
    id: "app",
    name: "",
    theme: "auto",
    periodId: null,     // the period shown on Home; empty means "the active one"
    seeded: false,
    updated: 0,
  },
};

/* Tombstones stay out of `state` but have to survive a reload, so they
   are kept here and written back alongside the live records. */
const graves = new Map(COLLECTIONS.map(c => [c, new Map()]));

/* ---------------------------------------------------------------
   Subscriptions
   --------------------------------------------------------------- */
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let notifyQueued = false;

export function notify() {
  /* Several changes in a row should redraw once. */
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  });
}

/* ---------------------------------------------------------------
   Startup
   --------------------------------------------------------------- */
export async function start() {
  state.storageWorks = await available();

  if (state.storageWorks) {
    const parts = await Promise.all(STORES.map(name => dbAll(name).catch(() => [])));
    STORES.forEach((name, i) => {
      const records = parts[i] || [];
      if (name === "settings") {
        const saved = records.find(r => r.id === "app");
        if (saved) state.settings = { ...state.settings, ...saved };
        return;
      }
      const grave = graves.get(name);
      if (!grave) return;
      for (const record of records) {
        if (record.deleted) grave.set(record.id, record);
        else state[name].push(record);
      }
    });
  }

  if (!state.settings.seeded && !state.periods.length) await seed();

  sortAll();
  state.loaded = true;
  notify();

  /* The cloud is optional and always second. */
  Sync.init({
    onRemote: applyRemote,
    onStatus: notify,
    localSnapshot: () => snapshot(),
  });

  return state;
}

async function seed() {
  const data = seedData(newId);
  const stamp = now();

  for (const [collection, records] of Object.entries(data)) {
    const stamped = records.map(r => ({ ...r, created: stamp, updated: stamp }));
    state[collection] = stamped;
    if (state.storageWorks) await dbPutMany(collection, stamped);
  }

  state.settings.seeded = true;
  state.settings.periodId = data.periods[0].id;
  await saveSettings({});
}

function sortAll() {
  state.periods.sort((a, b) => String(b.start).localeCompare(String(a.start)));
  state.goals.sort((a, b) => (a.order || 0) - (b.order || 0));
  state.milestones.sort((a, b) =>
    String(a.month || "").localeCompare(String(b.month || "")) || (a.order || 0) - (b.order || 0));
  state.metrics.sort((a, b) => (a.order || 0) - (b.order || 0));
  state.standards.sort((a, b) => (a.order || 0) - (b.order || 0));
  state.entries.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.created || 0) - (a.created || 0));
  state.topics.sort((a, b) => (a.order || 0) - (b.order || 0));
  state.modules.sort((a, b) => (a.order || 0) - (b.order || 0));
  state.backlog.sort((a, b) => (a.order || 0) - (b.order || 0));
  state.resources.sort((a, b) => (b.created || 0) - (a.created || 0));
  state.notes.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  state.weekly.sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart)));
  state.monthly.sort((a, b) => String(b.month).localeCompare(String(a.month)));
}

/* ---------------------------------------------------------------
   Writing
   --------------------------------------------------------------- */
async function persist(collection, record) {
  if (state.storageWorks) await dbPut(collection, record).catch(e => console.error(e));
  Sync.push(collection, record);
}

/* Add or update. Returns the stored record.

   `quiet` skips the redraw: used while you are typing into a field that
   saves itself, because redrawing the screen under a cursor moves it to
   the end of the text. */
export async function save(collection, values, { quiet = false } = {}) {
  const list = state[collection];
  if (!list) throw new Error(`Unknown collection: ${collection}`);

  /* An explicit `undefined` in `values` must not wipe a field — and it
     certainly must not wipe the id of a new record. */
  const fields = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

  const existing = fields.id ? list.find(r => r.id === fields.id) : null;
  const record = {
    ...(existing || { id: fields.id || newId(), created: now() }),
    ...fields,
    updated: now(),
  };

  if (existing) Object.assign(existing, record);
  else list.push(record);

  sortAll();
  if (!quiet) notify();
  await persist(collection, record);
  return record;
}

export async function saveMany(collection, records) {
  const stored = [];
  for (const values of records) stored.push(await save(collection, values));
  return stored;
}

export async function remove(collection, id) {
  const list = state[collection];
  const index = list.findIndex(r => r.id === id);
  if (index < 0) return;

  list.splice(index, 1);
  const stone = { id, deleted: true, updated: now() };
  graves.get(collection)?.set(id, stone);

  notify();
  await persist(collection, stone);
}

/* Removing a goal, topic or module takes its children with it. */
export async function removeCascade(collection, id) {
  const children = {
    periods: [["goals", "periodId"]],
    goals: [["milestones", "goalId"], ["metrics", "goalId"], ["standards", "goalId"]],
    topics: [["modules", "topicId"], ["resources", "topicId"]],
    modules: [["resources", "moduleId"]],
  }[collection] || [];

  for (const [childCollection, key] of children) {
    const ids = state[childCollection].filter(r => r[key] === id).map(r => r.id);
    for (const childId of ids) await removeCascade(childCollection, childId);
  }

  /* Entries and notes point at several things, so they are unhooked
     rather than deleted — a logged workout stays true even if the goal
     it belonged to is gone. */
  const links = { goals: "goalId", topics: "topicId", modules: "moduleId" }[collection];
  if (links) {
    for (const entry of state.entries.filter(e => e[links] === id)) {
      await save("entries", { ...entry, [links]: null });
    }
    for (const note of state.notes.filter(n => n.refId === id)) await remove("notes", note.id);
  }

  await remove(collection, id);
}

export async function saveSettings(values) {
  state.settings = { ...state.settings, ...values, updated: now() };
  notify();
  if (state.storageWorks) await dbPut("settings", state.settings).catch(e => console.error(e));
  Sync.push("settings", state.settings);
  return state.settings;
}

/* ---------------------------------------------------------------
   The cloud speaking back
   ---------------------------------------------------------------
   Last write wins, per record. A tombstone is a write like any other,
   which is what stops a deleted entry from coming back.
   --------------------------------------------------------------- */
function applyRemote(collection, records) {
  if (collection === "settings") {
    const remote = records.find(r => r.id === "app");
    if (remote && (remote.updated || 0) > (state.settings.updated || 0)) {
      state.settings = { ...state.settings, ...remote };
      if (state.storageWorks) dbPut("settings", state.settings).catch(e => console.error(e));
      notify();
    }
    return;
  }

  const list = state[collection];
  if (!list) return;
  const grave = graves.get(collection);
  let touched = false;

  for (const remote of records) {
    const index = list.findIndex(r => r.id === remote.id);
    const local = index >= 0 ? list[index] : grave.get(remote.id);
    if (local && (local.updated || 0) >= (remote.updated || 0)) continue;

    if (remote.deleted) {
      if (index >= 0) list.splice(index, 1);
      grave.set(remote.id, remote);
    } else {
      if (index >= 0) list[index] = remote;
      else list.push(remote);
      grave.delete(remote.id);
    }

    if (state.storageWorks) dbPut(collection, remote).catch(e => console.error(e));
    touched = true;
  }

  if (touched) { sortAll(); notify(); }
}

/* Everything local, for the first push to an empty cloud and for the
   backup file. */
export function snapshot() {
  const data = { settings: [state.settings] };
  for (const collection of COLLECTIONS) {
    data[collection] = state[collection].concat(Array.from(graves.get(collection).values()));
  }
  return data;
}

export async function restore(data, { replace = false } = {}) {
  if (replace) {
    for (const collection of COLLECTIONS) {
      state[collection] = [];
      graves.get(collection).clear();
      if (state.storageWorks) await dbClear(collection);
    }
  }

  for (const collection of COLLECTIONS) {
    const records = data[collection];
    if (!Array.isArray(records)) continue;
    applyRemote(collection, records.map(r => ({ ...r, updated: r.updated || now() })));
  }

  if (Array.isArray(data.settings) && data.settings[0]) {
    const rest = { ...data.settings[0] };
    delete rest.id;
    await saveSettings(rest);
  }

  sortAll();
  notify();
}

export async function wipe() {
  for (const collection of COLLECTIONS) {
    for (const record of state[collection].slice()) await remove(collection, record.id);
  }
  await saveSettings({ seeded: true, periodId: null });
  notify();
}

/* ---------------------------------------------------------------
   Looking things up
   --------------------------------------------------------------- */
export const byId = (collection, id) => state[collection].find(r => r.id === id) || null;

export function activePeriod() {
  if (state.settings.periodId) {
    const chosen = state.periods.find(p => p.id === state.settings.periodId);
    if (chosen) return chosen;
  }
  const today = todayISO();
  return state.periods.find(p => p.start <= today && p.end >= today)
      || state.periods.find(p => p.status === "active")
      || state.periods[0]
      || null;
}

export const goalsOf = periodId => state.goals.filter(g => g.periodId === periodId);
export const metricsOf = goalId => state.metrics.filter(m => m.goalId === goalId);
export const standardsOf = goalId => state.standards.filter(s => s.goalId === goalId);
export const milestonesOf = goalId => state.milestones.filter(m => m.goalId === goalId);
export const modulesOf = topicId => state.modules.filter(m => m.topicId === topicId);
export const notesOf = (level, refId) => state.notes.filter(n => n.level === level && n.refId === refId);

export function resourcesOf({ topicId = null, moduleId = null, goalId = null } = {}) {
  return state.resources.filter(r =>
    (moduleId && r.moduleId === moduleId) ||
    (topicId && !moduleId && r.topicId === topicId) ||
    (goalId && r.goalId === goalId));
}

/* Entries for a goal, a topic, a module or a type — all through one
   door, because every screen wants a slightly different slice. */
export function entriesFor({ goalId, topicId, moduleId, type, from, to, limit } = {}) {
  let list = state.entries;
  if (goalId)   list = list.filter(e => e.goalId === goalId);
  if (topicId)  list = list.filter(e => e.topicId === topicId);
  if (moduleId) list = list.filter(e => e.moduleId === moduleId);
  if (type)     list = list.filter(e => e.type === type);
  if (from)     list = list.filter(e => e.date >= from);
  if (to)       list = list.filter(e => e.date <= to);
  return limit ? list.slice(0, limit) : list;
}

export const currentTopic = () =>
  state.topics.find(t => t.status === "current") ||
  state.topics.find(t => t.status === "upcoming") || null;

/* ---------------------------------------------------------------
   Logging
   ---------------------------------------------------------------
   One entry shape for everything: a weight reading, a gym session, a
   study session, an hour of selling. `type` decides which fields mean
   anything, and metrics read their series straight off this list.
   --------------------------------------------------------------- */
export function logEntry({ type, date, value = null, duration = null, note = "",
                           tags = [], goalId, topicId = null, moduleId = null,
                           reflection = null, id = null }) {
  /* Which goal a log belongs to is a property of its type, so no caller
     has to work it out — and none of them can get it wrong. */
  if (goalId === undefined) goalId = goalForType(type);

  return save("entries", {
    id: id || undefined,
    type,
    date: date || todayISO(),
    value: value === "" || value === null ? null : Number(value),
    duration: duration === "" || duration === null ? null : Number(duration),
    note: String(note || "").trim(),
    tags: tags.filter(Boolean),
    goalId, topicId, moduleId,
    reflection: reflection && Object.values(reflection).some(v => v && v.trim()) ? reflection : null,
    week: weekStart(date || todayISO()),
    month: monthOf(date || todayISO()),
  });
}

/* Which goal does a type belong to? Answered by the seeded metrics and
   standards rather than by a list in the code, so a goal you add later
   claims its own types automatically. */
export function goalForType(type, periodId) {
  const goals = goalsOf(periodId || activePeriod()?.id);
  const ids = new Set(goals.map(g => g.id));
  const metric = state.metrics.find(m => m.type === type && ids.has(m.goalId));
  if (metric) return metric.goalId;
  const standard = state.standards.find(s => s.type === type && ids.has(s.goalId));
  return standard ? standard.goalId : null;
}

/* Every type that the current period actually uses, in goal order —
   this is what the quick-log sheet offers. */
export function loggableTypes(periodId) {
  const goals = goalsOf(periodId || activePeriod()?.id);
  const seen = [];
  for (const goal of goals) {
    for (const metric of metricsOf(goal.id)) {
      if (metric.type && !seen.some(t => t.type === metric.type)) seen.push({ type: metric.type, goalId: goal.id });
    }
    for (const standard of standardsOf(goal.id)) {
      if (standard.type && !seen.some(t => t.type === standard.type)) seen.push({ type: standard.type, goalId: goal.id });
    }
  }
  seen.push({ type: "learning", goalId: null });
  return seen;
}

/* ---------------------------------------------------------------
   Search
   --------------------------------------------------------------- */
export function search(query) {
  const needle = normalise(query);
  if (needle.length < 2) return [];

  const hits = [];
  const add = (kind, title, subtitle, route, text) => {
    if (!normalise(`${title} ${subtitle} ${text || ""}`).includes(needle)) return;
    hits.push({ kind, title, subtitle, route });
  };

  for (const goal of state.goals) {
    add("Goal", goal.title, periodTitle(goal.periodId), `#/goal/${goal.id}`, `${goal.objective} ${goal.why || ""}`);
  }
  for (const milestone of state.milestones) {
    const goal = byId("goals", milestone.goalId);
    add("Milestone", milestone.title, goal ? goal.title : "", `#/goal/${milestone.goalId}/milestones`);
  }
  for (const topic of state.topics) {
    add("Topic", topic.title, topic.outcome || "", `#/topic/${topic.id}`, topic.outcome);
  }
  for (const module of state.modules) {
    const topic = byId("topics", module.topicId);
    add("Module", module.title, topic ? topic.title : "", `#/module/${module.id}`, module.notes);
  }
  for (const resource of state.resources) {
    add("Resource", resource.title, resource.type || "", resource.moduleId ? `#/module/${resource.moduleId}`
      : resource.topicId ? `#/topic/${resource.topicId}` : "#/curiosity", resource.note);
  }
  for (const note of state.notes) {
    const route = note.level === "goal" ? `#/goal/${note.refId}/reflections`
      : note.level === "topic" ? `#/topic/${note.refId}` : `#/module/${note.refId}`;
    add("Note", note.title || "Note", noteOwner(note), route, note.text);
  }
  for (const entry of state.entries.filter(e => e.note || e.reflection)) {
    const route = entry.goalId ? `#/goal/${entry.goalId}/activity` : "#/reviews";
    add("Log", entry.note || "Reflection", entry.date, route,
      entry.reflection ? Object.values(entry.reflection).join(" ") : "");
  }

  return hits.slice(0, 40);
}

const periodTitle = id => byId("periods", id)?.title || "";

function noteOwner(note) {
  if (note.level === "goal") return byId("goals", note.refId)?.title || "";
  if (note.level === "topic") return byId("topics", note.refId)?.title || "";
  return byId("modules", note.refId)?.title || "";
}

export const canEdit = () => Sync.canEdit();
