# ◎ Goals

What you are trying to achieve, and what you are trying to learn — on one
page you can open in four seconds.

Not a task manager. A goal period, four goals, the behaviour you want to keep
up every week, and a place to log what you actually did. Plus a second half
for curiosity: the topics you want to understand, broken into modules, with
the notes and links you gathered along the way.

---

## What it does

### Home
The current period with the time left in it, the four goals with their
headline number and next milestone, this week's standards with how you are
doing against them, and whatever you are currently learning. One tap logs a
workout, an hour of selling, a Bible reading or a learning session.

### Goals
A goal period (September – December 2026, Q1 2027, a summer) holds goals.
Each goal has:

- **Milestones** — outcomes to reach, grouped by month.
- **Metrics** — what gets measured: bodyweight, revenue, loan balance, hours.
- **Standards** — behaviour to keep up, measured per week.
- **Activity** — every log, newest first.
- **Reflections** — what you wrote down along the way.

The distinction between a standard and a milestone is deliberate.
A standard is behaviour you maintain, a milestone is an outcome you reach.

### Reviews
A short weekly review that fills in its own numbers — standards met, hours
logged, learning time — and then asks three questions. A monthly review does
the same for milestones hit, metrics moved and standards kept.

### Curiosity
Topics outside the goals: history, watches, wine, fashion, the human body.
Each has modules you tick off, resources you save and notes you keep. Plus a
backlog for the things you want to get to later.

---

## Getting started

Open the link on your phone and choose **"Add to Home Screen"** from the share
menu. After that it sits between your other apps and opens without a browser
bar.

It works straight away and comes preloaded with the September – December 2026
period. Everything in it is editable — rename it, delete it, start your own.

---

## Syncing between devices (optional)

Without configuration your goals live only on the device you typed them into.
To have them on your phone *and* your laptop, it is a one-time setup:

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Open **SQL Editor → New query**, paste in the whole of **`supabase.sql`**
   from this folder, and press **Run**. That creates the table and the rules
   that keep your rows yours.
3. Go to **Project Settings → API** and copy the **Project URL** and the
   **anon / public** key.
4. Paste both into **`supabase-config.js`**, in place of `supabase: null`.
5. Under **Authentication → Providers**, make sure **Email** is on. For a
   personal app it is easier to switch *Confirm email* off, so a new account
   can sign in straight away.

Then sign in under Settings.

**Sign in on the device that already has your goals first.** Every device
seeds itself with the booklet on first run, so the *second* device would
otherwise add its own copy to yours. A device that has never been used —
nothing logged, nothing ticked, nothing written — hands itself over to the
cloud's copy instead of merging with it. A device you have actually used
merges, which is what you want the first time and not the second.

**About that anon key:** it belongs in a web app and is not a password. Every
request it makes still has to pass the row-level security policies from
`supabase.sql`, which only ever return your own rows. **Never** put the
`service_role` key there — that one bypasses every policy, and the file is
public the moment it is pushed.

### How the syncing works

- One table, `records`, one row per document: `user_id`, `collection`, `id`,
  `data` as jsonb, `updated`, `deleted`. That is the shape the app already
  keeps on the device, so nothing has to be taken apart and put back together.
- **Last write wins, per record.** Every record carries the moment it changed;
  an arriving row that is older than what is on this device changes nothing.
- **Deletes leave a tombstone**, so a device that was offline when you deleted
  something does not cheerfully put it back.
- Your own changes go up **immediately**. Changes from your other device
  arrive when the app opens, when you switch back to it, and every 45 seconds
  while you are looking at it.
- It is still **offline-first**: everything is written to the device before it
  is sent anywhere, so the app works on a plane and catches up later.

## Technical

- One folder of plain files, **no build step and no npm**. Open it in a
  browser and it runs.
- **Every gesture has a button.** Swipe between the tabs of a goal, between
  weeks in a review, a log row aside to delete it, a sheet down to dismiss it —
  and every one of those also has a tab, an arrow, a row or a close button that
  does the same thing. Nothing is only reachable by knowing a trick.
- **ES modules**, no frameworks and no libraries. The charts are inline SVG
  drawn at real pixel sizes after mount (a stretched SVG turns its own labels
  to mush), and the icons are inline paths.
- **Motion is one vocabulary**: a quick ease for state, a soft spring for
  anything that travels, and the whole lot switched off under
  `prefers-reduced-motion`.
- **IndexedDB** for storage, not localStorage: covers and years of logs add
  up, and localStorage stops around 5 MB.
- **Supabase** is a copy on top of local storage, not a replacement, and it is
  reached with plain `fetch` — no SDK, nothing from a CDN. Last write wins per
  record; deletes leave a tombstone so another device does not put back what
  you removed.
- The **service worker** goes to the network first and falls back to the
  cache, so you always get the newest version when online and the whole app
  when you are not.
- **Hosting:** GitHub Pages, straight from this repository.

### Files

```
index.html              the shell
supabase-config.js      your settings (local-only by default)
supabase.sql            the table and the rules — the actual security
manifest.json  sw.js    installable, and offline
css/app.css             the design, two themes
js/app.js               router and screen switching
js/store.js             all data and every change
js/progress.js          metrics, standards, reviews — the sums
js/db.js                IndexedDB
js/sync.js              Supabase (optional)
js/util.js              formatting, dates, the sheet, small charts
js/forms.js             every add and edit, in one place
js/log.js               the logging sheet and the activity list
js/cards.js             the goal card and the standard row
js/charts.js            rings, lines, bars and the day calendar
js/gestures.js          swiping: tabs, rows, sheets
js/icons.js             the line icons
js/data/types.js        what can be logged
js/data/seed.js         the starting period, goals and topics
js/views/*.js           one file per screen
```

---

## What it deliberately is not

No AI, no recommendations, no generated summaries or quizzes. No streaks to
protect, no badges, no leaderboards, nobody to compare yourself to. No bank,
Strava or Apple Health connections. No budgeting, no calorie counting.

It holds what you typed, and it does the arithmetic. That is the whole idea.

---

## Starting over

Settings → *Erase everything* removes every goal, log, topic and note. Make a
backup first — it cannot be undone.
