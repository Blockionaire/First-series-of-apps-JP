/* Engagement boundaries — the final setup-layer integrity pass.

   Two principles are under test:

     Client master data can be shared into an engagement.
     Audit work cannot be shared between engagements.

   and

     A person's firm identity is not the same thing as their responsibility
     on one engagement.
*/
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
const go = async (h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(320); };
const count = (sel) => p.locator(sel).count();

/* Anything below is loaded Vandersteen Revenue WORK. Naming the demo
   engagement is allowed — the empty state points at it on purpose — but no
   fragment of its file may appear on another engagement. */
const WORK_MARKERS = ['Ruud Timmermans', 'ServiceTrack', 'Business Central',
  'credit limit', '% understood', 'Step 3 of 7', 'Van Dijk Logistics',
  'Quotation, order, shipment'];

async function leaks() {
  const t = await txt();
  const found = WORK_MARKERS.filter(m => t.toLowerCase().includes(m.toLowerCase()));
  const structures = [];
  for (const [name, sel] of [['journey bar', '.jrn'], ['process map', '.mapg'],
                             ['RCM grid', '.agrid'], ['statements', '.claim'],
                             ['attention queue', '.aqi']]) {
    if (await count(sel) > 0) structures.push(name);
  }
  return [...found, ...structures];
}

// ── §21 DATA ISOLATION ──────────────────────────────────────────────────────
console.log('\n§21 — a new engagement never shows another engagement\'s work');
await E(() => window.__act.reset()); await p.waitForTimeout(400);
await go('#/client/new');
await p.fill('#name', 'Example Manufacturing B.V.');
await p.fill('#city', 'Breda');
await p.selectOption('#framework', 'Dutch GAAP');
await p.waitForTimeout(200);
await p.click('[data-act="create-client"]'); await p.waitForTimeout(450);
ok('the client is created', await has('Example Manufacturing'));

await p.click('[data-act="nav"][data-href="#/engagement/new"]'); await p.waitForTimeout(350);
await p.fill('#fy', 'FY2027'); await p.fill('#periodEnd', '31 December 2027');
await p.click('[data-act="eng-stage"][data-n="2"]'); await p.waitForTimeout(300);
await p.click('[data-act="eng-stage"][data-n="3"]'); await p.waitForTimeout(300);
ok('Revenue is in scope by default', await E(() => (window.__S.draft.processes||[]).includes('revenue')));
await p.click('[data-act="create-engagement"]'); await p.waitForTimeout(500);
ok('the engagement page is FY2027', await has('FY2027') && await has('Example Manufacturing'));
ok('and it is not the populated file', await E(() => !window.__st.processWorkspaceAvailable()));
ok('the engagement page shows no borrowed process progress',
   !(await has('% understood')) && !(await has('Step 3 of 7')));
ok('Revenue reads as in scope, not started', await has('not started'));

await go('#/revenue');
ok('entering Revenue opens the empty process state', await has('No Revenue work has been started yet'));
ok('it says where you are', await has('Example Manufacturing') && await has('FY2027'));
let l = await leaks();
ok('nothing from the Vandersteen file is on the page', l.length === 0, l.join(', '));

console.log('\n§21 — every process route goes through the same guard');
for (const r of ['#/prepare', '#/interview', '#/understanding', '#/controls', '#/trace',
                 '#/testing', '#/complete', '#/resolve', '#/matrix', '#/questionnaire', '#/cockpit']) {
  await go(r);
  const found = await leaks();
  const empty = await has('No Revenue work has been started yet');
  ok(`${r} is guarded`, empty && found.length === 0, found.join(', ') || (empty ? '' : 'not the empty state'));
}

console.log('\n§19 — the palette is scoped to the open engagement too');
const palOff = await E(() => { window.__S.palQuery = 'credit'; return window.__palette().map(x => x.group); });
ok('no controls, findings, sources or coverage are searchable', !palOff.some(g =>
  ['Controls','Findings','Coverage','Sources','Open items','Sections','Steps','Process variants','Process steps'].includes(g)),
  [...new Set(palOff)].join(', '));
const palAlways = await E(() => { window.__S.palQuery = ''; return window.__palette().map(x => x.group); });
ok('clients, engagements and firm people still are',
   palAlways.includes('Engagements') || palAlways.includes('Clients') || palAlways.includes('Go to'),
   [...new Set(palAlways)].join(', '));
await E(() => { window.__S.palQuery = ''; });

// ── §22 SWITCHING ───────────────────────────────────────────────────────────
console.log('\n§22 — switching engagements changes context cleanly');
await E(() => { window.__act.selectEngagement('ENG-2026-0142'); location.hash = '#/revenue'; });
await p.waitForTimeout(450);
ok('Vandersteen FY2026 opens the populated workspace', await count('.jrn') === 1 && await count('.mapg') === 1);
ok('with its own financial year', (await p.locator('.crumb').innerText()).includes('FY2026'));

await go('#/prepare');
await p.click('[data-act="prepare-done"]'); await p.waitForTimeout(450);
ok('a decision is recorded on the demo file', await E(() => window.__S.prepared === true));

await E(() => { const e = window.__st.allEngagements().find(x => x.fy === 'FY2027');
  window.__act.selectEngagement(e.id); location.hash = '#/revenue'; });
await p.waitForTimeout(450);
ok('the other engagement is still empty', await has('No Revenue work has been started yet'));
l = await leaks();
ok('the decision did not follow the user across', l.length === 0, l.join(', '));

await E(() => { window.__act.selectEngagement('ENG-2026-0142'); location.hash = '#/prepare'; });
await p.waitForTimeout(450);
ok('returning to Vandersteen finds its state intact', await E(() => window.__S.prepared === true));
ok('and its workspace still renders', await count('.jrn') === 1);
ok('its participants are unchanged',
   await E(() => window.__st.procParticipants('revenue').length) === 5);

// ── §23 ENGAGEMENT ROLES ────────────────────────────────────────────────────
console.log('\n§23 — firm role and engagement role are different things');
await go('#/people');
ok('Sanne Bakker carries the firm role Senior',
   await E(() => window.__st.firmUsers().find(u => u.name === 'Sanne Bakker').role) === 'Senior');
await E(() => { window.__act.openClient('CL-0142'); location.hash = '#/engagement/new'; });
await p.waitForTimeout(400);
await p.fill('#fy', 'FY2028'); await p.fill('#periodEnd', '31 December 2028');
await p.click('[data-act="eng-stage"][data-n="2"]'); await p.waitForTimeout(350);
ok('she is on the draft team as the logged-in user',
   await E(() => window.__S.draft.team.includes('FU-03')));
ok('her engagement role defaults to her firm role',
   await E(() => window.__S.draft.teamRoles['FU-03']) === 'Senior',
   await E(() => JSON.stringify(window.__S.draft.teamRoles)));
ok('the row shows both', await has('Firm role') && await has('Engagement role'));
await p.selectOption('#er-FU-03', 'Manager'); await p.waitForTimeout(300);
ok('the engagement role can be changed', await E(() => window.__S.draft.teamRoles['FU-03']) === 'Manager');
ok('changing it did NOT touch her firm role',
   await E(() => window.__st.firmUsers().find(u => u.id === 'FU-03').role) === 'Senior');
await p.click('[data-act="eng-stage"][data-n="3"]'); await p.waitForTimeout(300);
await p.click('[data-act="create-engagement"]'); await p.waitForTimeout(500);
ok('the created engagement records her as Manager',
   await E(() => window.__st.activeEngagement().team.find(t => t.userId === 'FU-03').role) === 'Manager',
   await E(() => JSON.stringify(window.__st.activeEngagement().team)));
ok('the engagement page says Manager', await has('Manager'));
await go('#/people');
ok('firm people still says Senior',
   await E(() => window.__st.firmUsers().find(u => u.id === 'FU-03').role) === 'Senior');
ok('the seeded Vandersteen FY2026 roles are untouched',
   await E(() => JSON.stringify(window.__st.engagementById('ENG-2026-0142').team)) ===
   JSON.stringify([{userId:'FU-01',role:'Partner'},{userId:'FU-02',role:'Manager'},
                   {userId:'FU-03',role:'Senior'},{userId:'FU-04',role:'Assistant'}]),
   await E(() => JSON.stringify(window.__st.engagementById('ENG-2026-0142').team)));
ok('sign-off still reads the ENGAGEMENT role',
   await E(() => { window.__act.selectEngagement('ENG-2026-0142');
     return window.__st.reviewerName(); }) === 'Sander Willemsen RA',
   await E(() => window.__st.reviewerName()));

// ── §24 CONTACT EDITING ─────────────────────────────────────────────────────
console.log('\n§24 — editing a client contact updates one record');
await E(() => { window.__act.openClient('CL-0142'); location.hash = '#/client'; });
await p.waitForTimeout(400);
const beforeContacts = await E(() => window.__st.clientById('CL-0142').contacts.length);
ok('the questionnaire is currently with Bas Kuipers (CC-02)',
   await E(() => window.__st.questionnaireTo('revenue').contactId) === 'CC-02');
await p.click('[data-act="edit-open"][data-id="contact:CC-02"]'); await p.waitForTimeout(300);
ok('the edit form opens on the existing record', await has('Edit Bas Kuipers'));
await p.fill('#ce-role', 'Chief Commercial Officer');
await p.fill('#ce-email', 'bas.kuipers@vandersteen.nl');
await p.fill('#ce-dept', 'Commercial');
await p.click('[data-act="save-contact-edit"]'); await p.waitForTimeout(450);
ok('no second person was created',
   await E(() => window.__st.clientById('CL-0142').contacts.length) === beforeContacts,
   String(await E(() => window.__st.clientById('CL-0142').contacts.length)));
ok('the id is unchanged', await E(() => !!window.__st.contactById('CC-02', 'CL-0142')));
ok('the client profile shows the new values',
   await has('Chief Commercial Officer') && await has('bas.kuipers@vandersteen.nl'));
ok('and not the old ones', !(await has('b.kuipers@vandersteen.nl')));
await go('#/prepare');
ok('Prepare shows the edited contact',
   await has('Chief Commercial Officer') && await has('bas.kuipers@vandersteen.nl'));
ok('still one Bas Kuipers on the process',
   await E(() => window.__st.procParticipants('revenue').filter(x => x.contact.name === 'Bas Kuipers').length) === 1);
await go('#/interview');
ok('the current questionnaire assignment shows the new values',
   await has('Chief Commercial Officer') && await has('bas.kuipers@vandersteen.nl'));
await p.click('[data-act="edit-open"][data-id="qto"]'); await p.waitForTimeout(300);
ok('so does the recipient picker', await has('Chief Commercial Officer'));
await p.click('[data-act="cancel-edit"]'); await p.waitForTimeout(250);

// ── §25 SYSTEM EDITING ──────────────────────────────────────────────────────
console.log('\n§25 — editing a client system updates one record');
await E(() => { window.__act.openClient('CL-0142'); location.hash = '#/client'; });
await p.waitForTimeout(400);
const beforeSystems = await E(() => window.__st.clientById('CL-0142').systems.length);
await p.click('[data-act="edit-open"][data-id="system:SY-02"]'); await p.waitForTimeout(300);
ok('the edit form opens on the existing system', await has('Edit ServiceTrack'));
await p.fill('#se-name', 'ServiceTrack Cloud');
await p.fill('#se-role', 'Service contracts, field service, deferral schedule, renewals');
await p.fill('#se-owner', 'P. Halsema');
await p.click('[data-act="save-system-edit"]'); await p.waitForTimeout(450);
ok('no second system was created',
   await E(() => window.__st.clientById('CL-0142').systems.length) === beforeSystems);
ok('the id is unchanged', await E(() => !!window.__st.systemById('SY-02', 'CL-0142')));
ok('the client profile shows the new name', await has('ServiceTrack Cloud'));
await go('#/prepare');
ok('Prepare shows the edited system', await has('ServiceTrack Cloud') && await has('renewals'));
ok('still three systems selected on Revenue',
   await E(() => window.__st.procSystemsFor('revenue').length) === 3);

// ── Reset ───────────────────────────────────────────────────────────────────
console.log('\nReset');
await E(() => window.__act.reset()); await p.waitForTimeout(400);
const after = await E(() => ({ clients: window.__st.allClients().length,
  engs: window.__st.allEngagements().length, engId: window.__S.engId,
  contact: window.__st.contactById('CC-02', 'CL-0142').role,
  system: window.__st.systemById('SY-02', 'CL-0142').name,
  available: window.__st.processWorkspaceAvailable() }));
ok('reset restores the seed', after.clients === 3 && after.engs === 4, JSON.stringify(after));
ok('including the unedited contact and system',
   after.contact === 'Commercial Director' && after.system === 'ServiceTrack', JSON.stringify(after));
ok('and the populated engagement is open again',
   after.engId === 'ENG-2026-0142' && after.available === true);

console.log('\n--- runtime errors:', errs.length ? errs.join('\n') : 'none');
console.log('--- FAILURES:', fails);
await b.close();
process.exit(fails ? 1 : 0);
