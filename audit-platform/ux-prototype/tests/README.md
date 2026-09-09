# Tests

Four Playwright suites, run against Chromium. They exist because the prototype has real state now
and a screenshot cannot tell you whether a gate is honest.

```
npm i playwright-core          # or use the pre-installed browser path below
python3 -m http.server 8765    # from ux-prototype/
node tests/smoke.mjs           # every route renders, plus route integrity
node tests/state-integrity.mjs # cases A-F: 50 assertions on the state model
node tests/ui-walk.mjs         # the seven-step workflow driven through the DOM
node tests/filecheck.mjs       # the standalone bundle, over file://
```

The browser path is hard-coded to `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; change it
if yours is elsewhere.

| Suite | What it protects |
|---|---|
| `smoke.mjs` | Every registered route renders and no `data-href` points at an unregistered route. `window.__checkRoutes()` also runs on boot and logs to the console. |
| `state-integrity.mjs` | Contradiction resolution propagates (A); undecided is not a conclusion (B); walkthroughs are per variant and feed step 4 (C); testing is conditional and extending is not concluding (D); questionnaire answers reach the fact model (E); sign-off is a state machine (F). |
| `ui-walk.mjs` | The same journey through the interface — clicks and keystrokes only — from Prepare to reviewer approval, plus the twelve-beat demo. |
| `filecheck.mjs` | `audit-ai-prototype.html` boots and works from `file://`, which is how design partners will open it. |

`tests/` is prototype tooling. It is not a production test strategy, and nothing here touches
`audit-engine`.
