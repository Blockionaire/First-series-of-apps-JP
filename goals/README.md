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

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and create a free project (the Spark plan is plenty).
2. Add a **web app** (the `</>` icon) and copy the `firebaseConfig` block.
3. Paste it into **`firebase-config.js`**, in place of `firebase: null`.
4. In the console, turn on **Authentication → Sign-in method → Email/password**.
5. Create a **Firestore database** and paste in the rules from
   `firestore.rules`.

Then sign in under Settings. Anything already on that device goes up with you.

**About that key in `firebase-config.js`:** it is meant to be public in a web
app and is not a password. What protects your data are the rules, which only
let you at documents under your own user id.

---

## Technical

- One folder of plain files, **no build step and no npm**. Open it in a
  browser and it runs.
- **ES modules**, no frameworks and no libraries. The charts are inline SVG
  and the icons are inline paths.
- **IndexedDB** for storage, not localStorage: covers and years of logs add
  up, and localStorage stops around 5 MB.
- **Firestore** is a copy on top of local storage, not a replacement. Last
  write wins per record; deletes leave a tombstone so another device does not
  put back what you removed.
- The **service worker** goes to the network first and falls back to the
  cache, so you always get the newest version when online and the whole app
  when you are not.
- **Hosting:** GitHub Pages, straight from this repository.

### Files

```
index.html              the shell
firebase-config.js      your settings (local-only by default)
firestore.rules         the database rules — the actual security
manifest.json  sw.js    installable, and offline
css/app.css             the design, two themes
js/app.js               router and screen switching
js/store.js             all data and every change
js/progress.js          metrics, standards, reviews — the sums
js/db.js                IndexedDB
js/sync.js              Firebase (optional)
js/util.js              formatting, dates, the sheet, small charts
js/forms.js             every add and edit, in one place
js/log.js               the logging sheet and the activity list
js/cards.js             the goal card and the standard row
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
