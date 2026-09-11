import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type()==='error') errs.push('CONSOLE ' + m.text()); });
await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(400);
let fails = 0;
const ok = (n,c,x='')=>{console.log((c?'  PASS ':'  FAIL ')+n+(x?'  ['+x+']':''));if(!c)fails++;};
const E = (fn,...a) => p.evaluate(fn,...a);
const txt = async () => (await p.locator('#app').innerText());
const has = async (x) => (await txt()).toLowerCase().includes(String(x).toLowerCase());

// ── §35 CLIENT ──────────────────────────────────────────────────────────────
console.log('\n§35 — create a client');
await p.evaluate(() => { location.hash = '#/clients'; }); await p.waitForTimeout(350);
ok('Clients lists the seeded clients', await has('Vandersteen') && await has('Meerveld') && await has('Brekelmans'));
ok('no process journey above the engagement', await p.locator('.jrn').count() === 0);
await p.click('[data-act="nav"][data-href="#/client/new"]'); await p.waitForTimeout(350);
ok('the create button is disabled with no name',
   await p.evaluate(() => document.querySelector('[data-act="create-client"]').disabled) === true);
await p.fill('#name', 'Example Manufacturing B.V.');
await p.fill('#sector', 'Manufacturing — precision components');
await p.selectOption('#country', 'Netherlands');
await p.fill('#city', 'Breda');
await p.selectOption('#framework', 'Dutch GAAP');
await p.fill('#yearEnd', '31 December');
await p.waitForTimeout(200);
await p.click('[data-act="create-client"]'); await p.waitForTimeout(450);
ok('lands on the new client page', await p.evaluate(()=>location.hash) === '#/client');
ok('and shows the new client', await has('Example Manufacturing'));
ok('the short name was derived', await p.evaluate(() =>
  window.__st.shownClient().short) === 'Example Manufacturing', await E(()=>window.__st.shownClient().short));
await p.evaluate(() => { location.hash = '#/clients'; }); await p.waitForTimeout(350);
ok('it appears in the client list', await has('Example Manufacturing'));
await p.evaluate(() => { const c = window.__st.allClients().find(x=>x.name.startsWith('Example'));
  window.__act.openClient(c.id); location.hash = '#/client'; }); await p.waitForTimeout(350);
await p.click('[data-act="edit-open"][data-id="contact"]'); await p.waitForTimeout(250);
await p.fill('#c-name', 'Erik Dalen'); await p.fill('#c-role', 'Financial Controller');
await p.fill('#c-email', 'e.dalen@example.nl');
await p.click('[data-act="save-contact"]'); await p.waitForTimeout(350);
ok('the contact is added to the client', await has('Erik Dalen') && await has('Financial Controller'));
await p.click('[data-act="edit-open"][data-id="system"]'); await p.waitForTimeout(250);
await p.fill('#s-name', 'Exact Online'); await p.fill('#s-role', 'Financial administration');
await p.click('[data-act="save-system"]'); await p.waitForTimeout(350);
ok('the system is added to the client', await has('Exact Online'));
const stored = await E(() => { const c = window.__st.allClients().find(x=>x.name.startsWith('Example'));
  return { contacts: c.contacts.length, systems: c.systems.length, id: c.id }; });
ok('both stay on that client record', stored.contacts === 1 && stored.systems === 1, JSON.stringify(stored));

// ── §36 ENGAGEMENT ──────────────────────────────────────────────────────────
console.log('\n§36 — create an engagement');
await p.click('[data-act="nav"][data-href="#/engagement/new"]'); await p.waitForTimeout(350);
ok('period end defaults from the client year-end',
   (await p.inputValue('#periodEnd')).includes('31 December'), await p.inputValue('#periodEnd'));
ok('the framework defaults from the client', await p.inputValue('#framework') === 'Dutch GAAP');
await p.fill('#fy', 'FY2027'); await p.fill('#periodEnd', '31 December 2027');
await p.selectOption('#type', 'Statutory audit');
await p.fill('#materiality', 'EUR 1,250,000');
await p.click('[data-act="eng-stage"][data-n="2"]'); await p.waitForTimeout(350);
ok('stage 2 is the audit team', await has('Audit team') && await has('Sanne Bakker'));
ok('the logged-in user is defaulted onto the team',
   await E(() => (window.__S.draft.team||[]).includes(window.__st.me().id)));
await p.click('[data-act="eng-team"][data-id="FU-02"]');
await p.click('[data-act="eng-team"][data-id="FU-05"]'); await p.waitForTimeout(300);
await p.click('[data-act="eng-stage"][data-n="3"]'); await p.waitForTimeout(350);
ok('stage 3 is the interim scope', await has('Interim scope'));
ok('Revenue defaults into scope', await E(() => (window.__S.draft.processes||['revenue']).includes('revenue')));
await p.click('[data-act="eng-proc"][data-id="purchases"]'); await p.waitForTimeout(250);
await p.click('[data-act="create-engagement"]'); await p.waitForTimeout(500);
ok('lands on the engagement page', await p.evaluate(()=>location.hash) === '#/engagement');
const eng = await E(() => { const e = window.__st.activeEngagement();
  return { fy: e.fy, procs: e.processes, team: e.team.length, mat: e.materiality, canonical: !!e.canonical }; });
ok('the engagement records FY2027', eng.fy === 'FY2027', eng.fy);
ok('with both processes in scope', eng.procs.includes('revenue') && eng.procs.includes('purchases'), JSON.stringify(eng.procs));
ok('and the team that was chosen', eng.team === 3, String(eng.team));
ok('materiality is stored as context', eng.mat === 'EUR 1,250,000');
ok('it is not the canonical demo engagement', eng.canonical === false);
ok('the page shows the engagement FY', await has('FY2027'));
ok('Purchasing shows as in scope with no methodology pack', await has('no methodology pack'));
ok('it is listed under the client',
   await E(() => window.__st.engagementsFor(window.__st.activeClient().id).some(e => e.fy === 'FY2027')));

// ── §39 FINANCIAL YEAR ──────────────────────────────────────────────────────
console.log('\n§39 — financial year is real state, not a literal');
ok('breadcrumb shows FY2027, not FY2026',
   (await p.locator('.crumb').innerText()).includes('FY2027') &&
   !(await p.locator('.crumb').innerText()).includes('FY2026'),
   await p.locator('.crumb').innerText());
await p.evaluate(() => { location.hash = '#/revenue'; }); await p.waitForTimeout(400);
ok('the process header shows FY2027', await has('FY2027'));
/* Audit work is engagement-scoped: a brand-new engagement has no loaded
   Revenue file, so the workspace — journey bar included — is not there to
   borrow. The boundary itself is tested in boundary-tests.mjs. */
ok('and a new engagement gets the empty process state, not another engagement\'s workspace',
   await p.locator('.jrn').count() === 0 && await has('No Revenue work has been started yet'));
await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(350);
ok('the Work engagement list shows FY2027', await has('FY2027'));
await p.evaluate(() => { location.hash = '#/questionnaire'; }); await p.waitForTimeout(350);
ok('the questionnaire has no recipient on a new engagement',
   await E(() => window.__st.questionnaireTo('revenue')) === null);

// switch back and confirm FY2026 returns
await p.evaluate(() => { window.__act.selectEngagement('ENG-2026-0142'); location.hash = '#/engagement'; });
await p.waitForTimeout(400);
ok('switching back restores FY2026', (await p.locator('.crumb').innerText()).includes('FY2026'));

// ── §37 PEOPLE ──────────────────────────────────────────────────────────────
console.log('\n§37 — firm people');
await p.evaluate(() => { location.hash = '#/people'; }); await p.waitForTimeout(350);
ok('existing colleagues appear', await has('Sander Willemsen') && await has('Marieke de Groot'));
ok('client contacts do NOT appear', !(await has('Ruud Timmermans')) && !(await has('Bas Kuipers')));
ok('audit role and access level are shown separately',
   await has('Manager') && await has('Admin') && await has('Member'));
await p.click('[data-act="edit-open"][data-id="invite"]'); await p.waitForTimeout(250);
await p.fill('#i-name', 'Lotte Verhoeven'); await p.fill('#i-email', 'l.verhoeven@kuyperbergman.nl');
await p.selectOption('#i-role', 'Senior'); await p.selectOption('#i-access', 'Member');
await p.click('[data-act="save-colleague"]'); await p.waitForTimeout(400);
ok('the colleague appears', await has('Lotte Verhoeven'));
ok('and the toast does not claim an e-mail was sent',
   /no invitation was sent/i.test(await p.locator('.undo').innerText()), await p.locator('.undo').innerText());
await p.evaluate(() => { window.__act.openClient('CL-0142'); location.hash = '#/engagement/new'; });
await p.waitForTimeout(400);
await p.click('[data-act="eng-stage"][data-n="2"]'); await p.waitForTimeout(350);
ok('the new colleague is selectable onto an engagement team', await has('Lotte Verhoeven'));

// ── §38 CLIENT CONTACTS → REVENUE ───────────────────────────────────────────
console.log('\n§38 — client contacts feed Revenue');
await p.evaluate(() => { window.__act.clearDraft(); window.__act.selectEngagement('ENG-2026-0142');
  window.__S.prepared = true; window.__st.commit(); location.hash = '#/prepare'; });
await p.waitForTimeout(400);
ok('Prepare consumes the client contacts', await has('People relevant to Revenue') && await has('Ruud Timmermans'));
ok('with their role on this process', await has('Walkthrough participant'));
ok('Prepare consumes the client systems', await has('Systems relevant to Revenue') && await has('ServiceTrack'));
ok('and shows the audit team separately', await has('Audit team on this engagement'));
const before = await E(() => window.__st.procParticipants('revenue').length);
await p.evaluate(() => window.__act.toggleParticipant('CC-06')); await p.waitForTimeout(300);
ok('a client contact can be added to the process',
   await E(() => window.__st.procParticipants('revenue').length) === before + 1);
ok('adding to a process does not create a firm user',
   await E(() => !window.__st.firmUsers().some(u => u.name === 'Marc de Wit')));
await p.evaluate(() => { location.hash = '#/interview'; }); await p.waitForTimeout(400);
ok('the interview shows the questionnaire recipient', await has('Questionnaire recipient') && await has('Bas Kuipers'));
await p.click('[data-act="edit-open"][data-id="qto"]'); await p.waitForTimeout(300);
await p.click('[data-act="assign-questionnaire"][data-id="CC-01"]'); await p.waitForTimeout(400);
ok('the recipient can be changed to another contact',
   await E(() => window.__st.questionnaireTo('revenue').contactId) === 'CC-01');
ok('and the toast does not claim an e-mail was sent',
   /nothing was e-?mailed/i.test(await p.locator('.undo').innerText()), await p.locator('.undo').innerText());
ok('the recipient is still not a firm user',
   await E(() => !window.__st.firmUsers().some(u => u.name === 'Ruud Timmermans')));

// ── Reset ───────────────────────────────────────────────────────────────────
console.log('\nReset');
await p.evaluate(() => window.__act.reset()); await p.waitForTimeout(400);
const after = await E(() => ({ clients: window.__st.allClients().length,
  engs: window.__st.allEngagements().length, users: window.__st.firmUsers().length,
  engId: window.__S.engId, hash: location.hash }));
ok('reset restores the seeded demo state',
   after.clients === 3 && after.engs === 4 && after.users === 7, JSON.stringify(after));
ok('and points back at the canonical engagement', after.engId === 'ENG-2026-0142');

console.log('\n--- runtime errors:', errs.length ? errs.join('\n') : 'none');
console.log('--- FAILURES:', fails);
await b.close();
process.exit(fails ? 1 : 0);
