import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1560, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(400);
let fails = 0;
const ok = (n,c,x='')=>{console.log((c?'  PASS ':'  FAIL ')+n+(x?'  ['+x+']':''));if(!c)fails++;};
const E = (fn,...a) => p.evaluate(fn,...a);

console.log('\nH — undo and reset');
await E(() => { const S=window.__S; S.prepared=true; S.generated=true; S.genSeen=true; S.analysed=true; S.anaSeen=true; window.__st.commit(); });

// undo a control decision
await E(() => window.__act.decideControl('C-04','key'));
ok('a control decision applies', await E(() => window.__S.controlDecisions['C-04']) === 'key');
await E(() => window.__st.undo());
ok('undo reverses it', await E(() => window.__S.controlDecisions['C-04']) === undefined);

// undo a per-control test conclusion
await E(() => { window.__act.decideControl('C-04','key'); window.__act.setTestScope('C-04','required'); window.__act.concludeTest('C-04','rely'); });
ok('a test conclusion applies', await E(() => window.__st.controlTest('C-04').conclusion) === 'rely');
await E(() => window.__st.undo());
ok('undo reverses the per-control test state', await E(() => window.__st.controlTest('C-04').conclusion) === null);

// undo a questionnaire answer, and its evidence
await E(() => window.__act.answerQuestion(13,'answer','Nobody reviews it routinely.'));
ok('the answer creates evidence', !!(await E(() => window.__refs(['Q:13'])[0]?.thisSession)));
await E(() => window.__st.undo());
ok('undo removes the answer', await E(() => window.__S.answers[13]) === undefined);
ok('and the evidence it created goes with it',
   await E(() => !!window.__refs(['Q:13'])[0]?.thisSession) === false);
ok('the fact it settled is unknown again',
   await E(() => window.__st.covFacts(window.__st.allItems().find(i=>i.id==='R5.3'))
     .find(f=>f.key==='override_report_reviewer').status) === 'unknown');

// undo a review point response
await E(() => { const S=window.__S; S.signOff={preparer:'signed',review:'submitted'}; window.__act.reviewerAction('reopened'); });
await E(() => window.__act.answerPoint('RP-01','Answered.'));
ok('a review point response applies', await E(() => window.__st.canResubmit()) === true);
await E(() => window.__st.undo());
ok('undo reopens the point and re-blocks resubmission', await E(() => window.__st.canResubmit()) === false);

// reset
await E(() => window.__act.reset()); await p.waitForTimeout(300);
const r = await E(() => ({
  hash: location.hash, prepared: window.__S.prepared, generated: window.__S.generated,
  analysed: window.__S.analysed, controls: window.__st.controlSummary().total,
  points: window.__st.reviewPoints().length, tests: Object.keys(window.__S.controlTests).length,
  answers: Object.keys(window.__S.answers).length,
  evidence: !!window.__refs(['Q:13'])[0]?.thisSession,
  next: window.__st.nextAction().href, state: window.__st.processState().id,
}));
ok('reset returns to the start', r.hash === '#/' && !r.prepared && !r.generated && !r.analysed);
ok('and clears the new state', r.controls === 0 && r.points === 0 && r.tests === 0 && r.answers === 0);
ok('and clears session evidence', r.evidence === false);
ok('and the next action is step 1 again', r.next === '#/prepare' && r.state === 'wip', r.next);
ok('undo stack is cleared', await E(() => window.__st.canUndo()) === false);

console.log('--- runtime errors:', errs.length ? errs.join('\n') : 'none');
console.log('--- FAILURES:', fails);
await b.close();
process.exit(fails ? 1 : 0);
