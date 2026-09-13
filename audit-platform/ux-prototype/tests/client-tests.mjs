/* The client experience.

   Two principles under test:

     The auditor sees the complexity. The client sees the next thing they
     need to do.

   and

     One audit workflow, two radically different interfaces — reading the
     same state.
*/
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type()==='error') errs.push('CONSOLE ' + m.text()); });
await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(450);
let fails = 0;
const ok = (n,c,x='')=>{console.log((c?'  PASS ':'  FAIL ')+n+(x?'  ['+x+']':''));if(!c)fails++;};
const E = (fn,...a) => p.evaluate(fn,...a);
const txt = async () => (await p.locator('#app').innerText());
const has = async (x) => (await txt()).toLowerCase().includes(String(x).toLowerCase());
const go = async (h,w=380) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w); };

// ── §39 PORTAL ──────────────────────────────────────────────────────────────
console.log('\n§39 — the portal shows one contact their own tasks');
await E(() => window.__act.reset()); await p.waitForTimeout(400);
ok('the canonical engagement is open', await E(() => window.__S.engId) === 'ENG-2026-0142');
await go('#/interview');
await E(() => { window.__S.prepared = true; window.__act.assignQuestionnaire('CC-02'); });
await p.waitForTimeout(350);
ok('the questionnaire is with Bas Kuipers',
   await E(() => window.__st.questionnaireTo('revenue').contactId) === 'CC-02');

await go('#/portal');
ok('the portal greets him by name', await has('Good afternoon, Bas'));
ok('he sees his questionnaire', await has('Revenue questionnaire'));
ok('and his document request', await has('Price override report'));
ok('he does NOT see his colleague\'s interview', !(await has('Revenue process interview')),
   'the interview belongs to Ruud Timmermans');
ok('nor the follow-up that the interview has not created yet',
   !(await has('credit limits')));
const mine = await E(() => window.__st.portalTasks('CC-02').map(t => t.id));
ok('every task shown belongs to him',
   await E(() => window.__st.portalTasks('CC-02').every(t => t.contactId === 'CC-02')), mine.join(','));
ok('and to this engagement',
   await E(() => window.__st.portalTasks('CC-02').every(t => t.engagementId === window.__S.engId)));

console.log('\n§36 — engagement isolation');
const otherEng = await E(() => {
  const e = window.__st.allEngagements().find(x => x.id !== 'ENG-2026-0142');
  window.__act.selectEngagement(e.id);
  return window.__st.portalTasks('CC-02').length;
});
ok('another engagement leaks no client tasks', otherEng === 0, String(otherEng));
await go('#/portal');
ok('and says so honestly', await has('Nothing has been sent to you yet'));
await E(() => window.__act.selectEngagement('ENG-2026-0142')); await p.waitForTimeout(300);

// ── §42 CLIENT SECRECY ──────────────────────────────────────────────────────
console.log('\n§42 — nothing of the audit\'s internals reaches the client');
/* Anything below is auditor-only vocabulary or an internal identifier. */
const FORBIDDEN = [
  'coverage', 'assertion', 'methodology', 'significant deficiency', 'control deficiency',
  'risk signal', 'contradiction', 'key control', 'walkthrough', 'ISA ', 'C-0', 'R-0',
  'G-0', 'R1.', 'R2.', 'R5.', 'confidence', 'review point', 'reviewer', 'sign-off',
  'completion gate', 'working paper', 'evidence', 'occurrence', 'cut-off', 'provenance',
];
async function secrecy(label) {
  const t = (await p.locator('body').innerText());
  const hit = FORBIDDEN.filter(w => t.toLowerCase().includes(w.toLowerCase()));
  ok(`${label} says nothing auditor-only`, hit.length === 0, hit.join(', '));
}
await go('#/portal'); await secrecy('portal home');
await go('#/portal/questionnaire'); await secrecy('questionnaire');
await E(() => window.__act.portalAs('CC-01')); await p.waitForTimeout(250);
await go('#/portal/interview'); await secrecy('interview task');
await go('#/portal/interview/waiting'); await secrecy('waiting room');
await E(() => { window.__S.interview.consent = true; window.__S.interview.status = 'live'; window.__st.commit(); });
await go('#/portal/interview/live'); await secrecy('live interview');
await go('#/portal/document'); await secrecy('document request');

// ── §40 QUESTIONNAIRE ───────────────────────────────────────────────────────
console.log('\n§40 — the questionnaire is the same questionnaire');
await E(() => window.__act.portalAs('CC-02')); await p.waitForTimeout(250);
await go('#/portal');
const before = await E(() => window.__st.questionnaireProgress());
ok('the task shows real progress', await has(`${before.done} of ${before.total} answered`),
   `${before.done}/${before.total}`);
await p.click('[data-act="nav"][data-href="#/portal/questionnaire"]'); await p.waitForTimeout(400);
ok('it opens in the portal, not the auditor shell', await p.locator('.pt__bar').count() === 1);
ok('and no "auditor view" button sits in the client header',
   !(await p.locator('.pt__bar').innerText()).toLowerCase().includes('auditor'));
const qn = await E(() => { const q = window.__narrative ? null : null;
  const el = document.querySelector('textarea[id^="q-"]'); return el ? el.id : null; });
ok('a question is waiting', !!qn, String(qn));
await p.fill(`#${qn}`, 'The controller runs it at month end and initials the printout.');
await p.click('[data-act="answer-send"]'); await p.waitForTimeout(450);
const after = await E(() => window.__st.questionnaireProgress());
ok('answering advances the same progress', after.done === before.done + 1,
   `${before.done} -> ${after.done}`);
ok('the answer became auditor-side evidence',
   await E(() => Object.keys(window.__st.S.answers).length > 0));
await go('#/portal');
ok('the portal task reflects it', await has(`${after.done} of ${after.total} answered`));
await go('#/interview');
ok('and the auditor sees the same count', await has(`${after.done} of ${after.total} answered`));
ok('there is one questionnaire, not two',
   await E(() => window.__st.questionnaireProgress().done) === after.done);

// ── §24 AUDITOR-SIDE STATUS ─────────────────────────────────────────────────
console.log('\n§24 — the auditor sees where client tasks have got to');
ok('the process interview lists the client tasks', await has('With the client'));
ok('naming the contact for each', await has('Bas Kuipers') && await has('Ruud Timmermans'));
ok('and offers a prototype portal preview', await has('Preview the client portal'));

// ── §41 LIVE INTERVIEW, BOTH SIDES ──────────────────────────────────────────
console.log('\n§41 — one interview, two views');
await E(() => { window.__act.portalAs('CC-01');
  window.__S.interview = { ...window.__S.interview, status: 'scheduled', turn: 6, consent: false };
  window.__st.commit(); });
await go('#/portal/interview');
ok('the interview task shows when, how long and with whom',
   await has('Thursday 17 September') && await has('30 minutes') && await has('Sanne Bakker'));
await p.click('[data-act="iv-enter"]'); await p.waitForTimeout(400);
ok('joining goes to the waiting room', await p.evaluate(()=>location.hash) === '#/portal/interview/waiting');
ok('and Join is blocked until the transcription note is acknowledged',
   await E(() => document.querySelector('[data-act="iv-join"]').disabled) === true);
await p.click('#iv-consent'); await p.waitForTimeout(300);
ok('ticking it releases Join',
   await E(() => document.querySelector('[data-act="iv-join"]').disabled) === false);
await p.click('[data-act="iv-join"]'); await p.waitForTimeout(450);
ok('the interview is live', await p.evaluate(()=>location.hash) === '#/portal/interview/live');
ok('the client sees the conversation', await has('Thanks for the time'));
ok('and the subject, in plain words', await has('Now talking about'));

const t0 = await E(() => window.__S.interview.turn);
await p.click('[data-act="iv-next"]'); await p.waitForTimeout(350);
const t1 = await E(() => window.__S.interview.turn);
ok('advancing client-side moves the shared turn', t1 === t0 + 1, `${t0} -> ${t1}`);

await go('#/cockpit', 450);
ok('the auditor cockpit is on the same turn',
   await E(() => window.__S.interview.turn) === t1);
const cockpitTurns = await E(() => document.querySelectorAll('.turn').length);
ok('and shows exactly that many turns', cockpitTurns === t1, `${cockpitTurns} vs ${t1}`);
ok('the cockpit keeps its auditor-only layer', await has('Suggestions') && await has('Understanding, live'));

await p.click('[data-act="cockpit-next"]'); await p.waitForTimeout(350);
const t2 = await E(() => window.__S.interview.turn);
ok('advancing auditor-side moves it too', t2 === t1 + 1, `${t1} -> ${t2}`);
await go('#/portal/interview/live', 450);
const clientTurns = await E(() => document.querySelectorAll('.pturn').length);
ok('and the client transcript has advanced with it', clientTurns === t2, `${clientTurns} vs ${t2}`);

await p.click('[data-act="iv-end"]'); await p.waitForTimeout(450);
ok('ending shows the client a thank-you', await has('Interview complete'));
ok('with no coverage, contradictions or controls in it',
   !(await has('coverage')) && !(await has('contradiction')) && !(await has('control')));
ok('the shared state is complete', await E(() => window.__S.interview.status) === 'complete');
await go('#/cockpit', 450);
ok('and the auditor side agrees', await has('Interview complete'));

// ── §20 FOLLOW-UP ───────────────────────────────────────────────────────────
console.log('\n§20 — the interview creates a follow-up for another contact');
await E(() => window.__act.portalAs('CC-02')); await p.waitForTimeout(250);
await go('#/portal');
ok('Bas now has a follow-up', await has('credit limits'));
await p.click('[data-act="nav"][data-href="#/portal/follow-up"]'); await p.waitForTimeout(400);
ok('it is one question on the same surface', await has('release it yourself'));
await p.fill('#fu', 'No. Credit control release it; I only chase them.');
await p.click('[data-act="follow-send"]'); await p.waitForTimeout(450);
ok('the answer is recorded', await E(() => window.__S.followUp.kind) === 'answer');
ok('and it returns to the task inbox', await p.evaluate(()=>location.hash) === '#/portal');
ok('the task now sits with the auditor',
   await E(() => window.__st.taskState(window.__st.followUpTask())) === 'waiting');

// ── §21 DOCUMENT REQUEST ────────────────────────────────────────────────────
console.log('\n§21 — the document request is a mock, and says so');
await go('#/portal/document');
ok('it explains what is wanted', await has('price override report'));
ok('and does not claim to store anything', await has('No file is read, uploaded or stored'));
await p.click('[data-act="upload-doc"]'); await p.waitForTimeout(450);
ok('it marks as received', await has('Received'));
await go('#/portal');
ok('and the task is done', await E(() =>
  window.__st.taskState(window.__st.taskById('CT-03'))) === 'completed');

// ── Reset ───────────────────────────────────────────────────────────────────
console.log('\nReset');
await E(() => window.__act.reset()); await p.waitForTimeout(400);
const fresh = await E(() => ({
  status: window.__S.interview.status, turn: window.__S.interview.turn,
  as: window.__S.portalAs, follow: window.__S.followUp,
  uploads: Object.keys(window.__S.uploads).length,
  open: window.__st.portalOpenTasks('CC-02').length,
  done: window.__st.portalDoneTasks('CC-02').length,
}));
ok('the interview is back to scheduled', fresh.status === 'scheduled' && fresh.turn === 6,
   JSON.stringify(fresh));
ok('the follow-up and the upload are gone', fresh.follow === null && fresh.uploads === 0);
ok('and Bas is back to two open tasks and one done', fresh.open === 2 && fresh.done === 1,
   JSON.stringify(fresh));

console.log('\n--- runtime errors:', errs.length ? errs.join('\n') : 'none');
console.log('--- FAILURES:', fails);
await b.close();
process.exit(fails ? 1 : 0);
