# Setup Layer v1

The parent of the interim workflow: how a firm gets from a new client to an active Revenue interim
engagement. Additive — nothing in `PRE-DESIGN-FUNCTIONAL-FREEZE.md` changed.

---

## 1. The hierarchy

```
FIRM  Kuyper & Bergman Accountants
│
├── People ─────────────── firm users: an audit role AND an access level
│
└── Clients
    └── Client ─────────── profile · contacts · systems
        └── Engagements    one per financial year
            └── FY2026
                ├── Planning
                ├── Interim ─── Revenue · Purchasing · Payroll · Inventory · Treasury · Close
                ├── Final
                └── Completion
```

Only **Vandersteen FY2026** is `canonical: true` — the one engagement with a methodology pack, a
transcript and evidence behind it. Every other engagement is a real record whose Revenue workflow
opens and says honestly that it has no sources loaded. The prototype does not invent a process
understanding for a client it has never interviewed.

---

## 2. Three kinds of people, deliberately apart

This is the distinction the layer exists to protect. Collapsing it into one "users" table is the
mistake that makes an audit tool leak client data.

| | **Firm user** | **Client contact** | **Client access** |
|---|---|---|---|
| Who | A colleague at the firm | A person at the audited entity | A contact, for one task |
| Lives on | The firm | The **client** record | A process, as a grant |
| Has | Audit role *and* access level | A professional title | A questionnaire, and nothing else |
| Is an account? | Yes, eventually | **Never** | No |
| Example | Sanne Bakker · Senior · Member | Ruud Timmermans · Financial Controller | Bas Kuipers → Revenue questionnaire |
| In the code | `S.firmUsers` | `client.contacts` | `S.questionnaireTo["engId::proc"]` |

**Audit role** (Partner / Manager / Senior / Assistant) is what someone does on an engagement.
**Access level** (Member / Admin) is what they can do in the software. They are different axes and
the People screen shows them in separate columns, because a partner is not automatically an
administrator and an administrator is not automatically a reviewer.

Adding a client contact never creates an account. Assigning a questionnaire grants access to that
questionnaire and nothing else. Both toasts say so in words.

---

## 3. The client model

A client owns its **profile**, its **contacts** and its **systems**. Those three outlive any
engagement, which is why they live here and not on the engagement or the process.

```
Client { id, name, short, country, city, sector, framework, yearEnd, since, acceptance,
         contacts: [ClientContact], systems: [ClientSystem] }

ClientContact { id, name, role, email, department }     professional title, not a permission
ClientSystem  { id, name, role, owner, note }
```

`framework` and `yearEnd` are the defaults every new engagement inherits — the auditor should not
retype what the client record already knows.

---

## 4. The engagement model

One per client per financial year. It carries the period, the team and the scope.

```
Engagement { id, clientId, canonical,
             fy, periodStart, periodEnd, type, framework,
             materiality, performanceMateriality,
             phase, phaseDetail,
             team: [{ userId, role }],        // references firm users, never copies them
             processes: [processId] }
```

The team **references** firm users by id. A colleague is not duplicated per engagement, so a role
change at firm level is not silently forked into four stale copies.

Created through three short stages — **Engagement → Audit team → Interim scope** — because those are
three different decisions, not because a wizard is good. Defaults do the work: period end from the
client's year-end, financial year derived from the period end, framework from the client, the
logged-in user onto the team, Revenue into scope.

---

## 5. Financial year is state, not a label

Every dynamic FY in the product now reads from the active engagement:

```
S.engId  →  st.activeEngagement()  →  breadcrumb · engagement page · process header ·
                                       Work list · export footer · questionnaire context
```

Creating an FY2027 engagement makes the whole application say FY2027. Switching back says FY2026.
There is no `FY2026` literal left in any dynamic product context.

Fictional copy *inside* the source documents — the transcript, the prior-year narrative, the
questionnaire answers — still says 2026, correctly: those are documents about a specific year, and
rewriting them per engagement would be faking evidence.

---

## 5b. Process work is engagement-scoped

The setup layer lets anyone create a real client, a real financial year and a real scope. The audit
work behind Revenue is a different kind of object, and it does not travel.

- **Every engagement conceptually owns its own process file** — its understanding, sources,
  controls, findings, walkthroughs, tests, open items, review points and completion state.
- **The prototype ships exactly one populated file**: Vandersteen FY2026 Revenue. It is the only
  engagement with a methodology pack, a transcript and documents behind it.
- **Every other engagement shows an empty process state** — deliberately, not as an error. It names
  the client, the financial year and the phase, says Revenue is in scope and not started, and
  offers a way into the populated demo.
- **No data is shared across engagements.** Nothing from Vandersteen's file appears on another
  engagement: no map, no coverage percentage, no source, no control, no finding, no questionnaire.
- **Production will need true per-engagement persistence.** The boundary here is a routing guard
  over one in-memory file, not a storage model.

One capability check carries this, asked as a product question rather than a demo check:

```js
st.processWorkspaceAvailable(engagement, "revenue")   // does this engagement have loaded process work?
```

The router applies it once, to every route that is part of a Revenue file — `#/revenue`,
`#/prepare`, `#/interview`, `#/understanding`, `#/controls`, `#/trace`, `#/testing`, `#/complete`,
`#/resolve`, `#/matrix`, `#/questionnaire`, `#/cockpit`. Typing one by hand goes through the same
guard, because the router is the only way in. The keyboard model and the ⌘K index are scoped the
same way: with another engagement open, Revenue's controls, findings, sources, sections, coverage
areas and open items are simply not searchable, rather than silently switching the user's
engagement out from under them.

---

## 5c. Firm role, access level, engagement role

Three axes, not two:

| | Set on | Means | Changed by |
|---|---|---|---|
| **Firm role** | Firm people | Their grade at the firm — Partner / Manager / Senior / Assistant | Firm people |
| **Access level** | Firm people | What they can do in the software — Member / Admin | Firm people |
| **Engagement role** | The engagement team | What they are responsible for on *this* file | The engagement |

Sanne Bakker is a Senior at the firm and can be a Manager on one engagement. The new-engagement team
stage shows both: her firm role as read-only context, her engagement role as a select, defaulted
from the firm role and independent of it from then on. In state the team is `{ userId, role }`,
where `role` is the engagement role, written once at creation and never re-derived from
`firmUser.role` afterwards — so a firm-level promotion cannot rewrite an engagement that has already
been signed off, and an engagement role cannot promote anyone at the firm.

Sign-off reads the engagement role: `reviewerName()` and `partnerName()` look at the team on the
engagement, which is the correct source for engagement responsibility.

---

## 5d. Editing client master data

Client contacts and client systems can be edited in place from the client profile — name, role,
e-mail, department for a contact; name, purpose, owner, note for a system.

The edit **mutates the existing record**. `CC-01` stays `CC-01`. That matters because process
participants, questionnaire grants and recorded evidence reference the contact by id, and systems
are selected into a process by id: replacing the record would fork one person into two. Everything
that resolves through the id — the client profile, Prepare's people and systems, the questionnaire
recipient picker and the current assignment — shows the new values immediately, with no second
person and no duplicate system.

Deletion, archiving, change history, per-record permissions and anything else CRM-shaped is
deliberately absent.

---

## 6. Materiality

Engagement context, stored and displayed on the engagement overview. It is optional, and **nothing
in the interim process work reads it**. No completion gate depends on it and no sampling logic was
introduced because it now exists. Materiality drives the final audit; process-level interim work
does not consume it, and the form says so under the field.

---

## 7. Process scope, and what Prepare consumes

Engagement scope is a list of process ids. Only Revenue has a methodology pack; the rest appear in
scope and not started, labelled *no methodology pack*.

**Prepare consumes master data, it does not own it.** Step 1 now selects which of the client's
contacts and systems matter to Revenue:

```
S.participants["ENG-2026-0142::revenue"] = [{ contactId, role }]
S.procSystems["ENG-2026-0142::revenue"]  = [systemId]
```

A contact on Revenue carries a **process role** — walkthrough participant, questionnaire
participant, follow-up contact, evidence provider — which is a different thing from their
professional title. Adding a new contact from inside Prepare writes to the **client** record, which
stays the source of truth: one person, one record.

The audit team appears on the same screen under its own heading, so auditors and client people are
never in the same list.

---

## 8. Questionnaire assignment

The Process interview screen now names the recipient. Choosing one records a task-scoped grant, and
the toast says *"nothing was e-mailed"* — because nothing was. A contact without an e-mail on file
is shown as such when picking, since that is the one field the grant actually needs.

---

## 9. Intentionally mocked

Everything is in-memory session state, seeded from `js/data-firm.js` and restored by reset.

- Creating a client, an engagement, a contact, a system or a colleague writes to `S` and nothing
  else. Closing the tab loses it.
- "Invite colleague" creates a record. No e-mail, no account, no password. The toast says so.
- "Questionnaire assigned" grants access inside the prototype. No message is sent.
- Client acceptance shows as *completed* on the seeded clients and *not started* on new ones. It is
  a status field, not a workflow.
- Firm settings is in the avatar menu, marked *future*, and does nothing.

---

## 10. Explicitly deferred

Authentication, passwords, real invitations, e-mail delivery, SSO, Microsoft Entra, MFA, SCIM,
provisioning, a permission engine, a database, multi-tenancy, billing, licensing, methodology
administration, the client acceptance and continuance workflow (AML/KYC, independence, sanctions,
conflicts, approval routing), full audit planning, risk analysis, the final audit, and integrations.

The access level on a firm user is a label with no enforcement behind it. That is deliberate: a
permission model that is displayed but not enforced is worse than one that is honestly absent, so
the People screen says what it is.
