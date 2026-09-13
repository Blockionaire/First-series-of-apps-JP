# Tests

Eight Playwright suites, run against Chromium. They exist because the prototype has real state now
and a screenshot cannot tell you whether a gate is honest.

```
npm i playwright-core          # or use the pre-installed browser path below
python3 -m http.server 8765    # from ux-prototype/
node tests/smoke.mjs           # every route renders, plus route integrity
node tests/state-integrity.mjs # cases A-F: 50 assertions on the state model
node tests/ui-walk.mjs         # the seven-step workflow driven through the DOM
node tests/filecheck.mjs       # the standalone bundle, over file://
node tests/boundary-tests.mjs  # engagement boundaries: isolation, roles, master-data edits
node tests/client-tests.mjs    # the client portal, the questionnaire and the shared interview
```

The browser path is hard-coded to `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; change it
if yours is elsewhere.

| Suite | What it protects |
|---|---|
| `smoke.mjs` | Every registered route renders and no `data-href` points at an unregistered route. `window.__checkRoutes()` also runs on boot and logs to the console. |
| `state-integrity.mjs` | Contradiction resolution propagates (A); undecided is not a conclusion (B); walkthroughs are per variant and feed step 4 (C); testing is conditional and extending is not concluding (D); one control's test conclusion never closes another's (D2); questionnaire answers become real evidence (E); sign-off is a state machine with a working review-point loop (F). |
| `ui-walk.mjs` | The same journey through the interface — clicks and keystrokes only — from Prepare to reviewer approval, plus the twelve-beat demo. |
| `filecheck.mjs` | `audit-ai-prototype.html` boots and works from `file://`, which is how design partners will open it. |
| `undo-reset.mjs` | Every decision the later passes added is undoable, session evidence is undone with the answer that created it, and reset returns a valid start state. |
| `boundary-tests.mjs` | The engagement boundary. No fragment of the Vandersteen Revenue file reaches another engagement through any of the twelve process routes, the keyboard or ⌘K; switching engagements and back leaves both intact; firm role and engagement role move independently; editing a client contact or system mutates the existing record and propagates by id without duplicating anybody. |
| `client-tests.mjs` | The client experience. One contact sees only their own tasks and only on the active engagement; no client-facing screen contains coverage, an assertion, a methodology or object id, a control, a finding classification, a reviewer or a completion gate; the portal questionnaire is the auditor's questionnaire and produces the same evidence; the interview advances identically from either side and ends on both; the interview creates a follow-up for a different contact; the document request stores nothing and says so. |
| `setup-tests.mjs` | The setup layer: creating a client, adding a contact and a system, the three-stage new-engagement flow, financial year propagating as real state, firm people staying separate from client contacts, and Prepare consuming the client record. |

`tests/` is prototype tooling. It is not a production test strategy, and nothing here touches
`audit-engine`.
