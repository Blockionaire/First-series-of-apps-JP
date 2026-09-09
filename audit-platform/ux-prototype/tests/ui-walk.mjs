import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1560, height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(400);
let fails = 0;
const ok = (n, c, x='') => { console.log((c?'  PASS ':'  FAIL ')+n+(x?'  ['+x+']':'')); if(!c) fails++; };
const shot = (n) => p.screenshot({ path: `${n}.png`, fullPage: false });
const txt = async () => (await p.locator('#app').innerText());
const has = async (x) => (await txt()).toLowerCase().includes(x.toLowerCase());

// 1 — Prepare: confirm navigates onward
await p.evaluate(() => location.hash = '#/prepare'); await p.waitForTimeout(250);
ok('prepare shows carried context', await has('carried into interim'));
ok('prepare shows the variants', await has('Process variants in scope'));
await shot('w1-prepare');
await p.click('button:has-text("Confirm and start the process interview")'); await p.waitForTimeout(450);
ok('confirming navigates to the interview', await p.evaluate(() => location.hash) === '#/interview', await p.evaluate(()=>location.hash));
ok('the interview is titled Process interview', (await p.locator('h1').first().innerText()).toLowerCase().includes('process interview'));
await shot('w2-interview');

// 2 — Understanding: run the pipeline, see the result, work the queue
await p.click('[data-act="nav"][data-href="#/understanding"]'); await p.waitForTimeout(350);
await p.click('[data-act="run-pipeline"]');
await p.waitForSelector('text=could not be validated', { timeout: 40000 });
ok('the pipeline result waits to be read', await has('could not be validated'));
await shot('w3-pipeline');
await p.click('[data-act="read-gen"]'); await p.waitForTimeout(300);
await p.click('[data-act="start-focus"][data-kind="claims"]'); await p.waitForTimeout(300);
ok('the contradiction is first and offers numbered options', await has('credit limit'));
await shot('w4-contradiction');
await p.keyboard.press('1'); await p.waitForTimeout(300);
for (let i=0;i<4;i++){ await p.keyboard.press('Enter'); await p.waitForTimeout(220); }
await p.evaluate(() => { const A=window.__act, st=window.__st; A.acceptClean();
  (window.__narrative||[]).forEach(s=>{ if(st.sectionApprovable(s)) A.approveSection(s.id); }); });
await p.waitForTimeout(250);

// 3 — Controls: park, then carry forward with a reason; modify a finding
await p.evaluate(() => location.hash = '#/controls'); await p.waitForTimeout(300);
await shot('w5-controls');
await p.click('[data-act="start-focus"][data-kind="controls"]'); await p.waitForTimeout(300);
ok('the control focus offers Carry forward undecided', await has('Carry forward undecided'));
await p.keyboard.press('u'); await p.waitForTimeout(250);
await p.click('[data-act="carry-control-open"]'); await p.waitForTimeout(250);
ok('carrying forward asks for a reason', await has('This reason goes on the file'));
await shot('w6-carry-reason');
await p.fill('#ans', 'The control owner is on leave until the final audit.');
await p.click('button:has-text("Carry forward with this reason")'); await p.waitForTimeout(300);
ok('the reason is stored', await p.evaluate(() => Object.keys(window.__S.controlCarry).length) === 1);

// conclude the rest, then the findings, with one modified
await p.evaluate(() => { const A=window.__act, st=window.__st;
  st.controlSummary().queue.slice().forEach(c => A.decideControl(c.id, c.keyProposal === false ? 'not_key' : 'key')); });
await p.evaluate(() => { window.__act.startFocus('findings'); }); await p.waitForTimeout(300);
ok('the finding focus offers Modify', await has('Modify'));
await p.click('[data-act="edit-finding"]'); await p.waitForTimeout(250);
ok('modify opens an editable form', await p.locator('#f-title').count() === 1);
await shot('w7-modify');
await p.fill('#f-title', 'Acceptance protocols are not retained in any system');
await p.selectOption('#f-sev', 'significant_deficiency_candidate');
await p.click('[data-act="save-finding"]'); await p.waitForTimeout(300);
const mod = await p.evaluate(() => { const d = Object.values(window.__S.findingDecisions).find(x => x.decision === 'modified'); return d && d.fields; });
ok('the modified finding stores the auditor version', !!mod && mod.severity === 'significant_deficiency_candidate', JSON.stringify(mod && mod.title));
await p.evaluate(() => { const A=window.__act, st=window.__st;
  st.findingSummary().queue.slice().forEach(f => A.decideFinding(f.id, 'confirmed')); });

// 4 — Trace: decide per variant, then trace
await p.evaluate(() => location.hash = '#/trace'); await p.waitForTimeout(300);
const t1 = await txt();
ok('all three variants are listed', t1.includes('Machine sales') && t1.includes('Spare part sales') && t1.includes('Service and maintenance'));
ok('each asks whether a walkthrough is required', (t1.match(/Does this variant need a line walkthrough\?/g)||[]).length === 3, String((t1.match(/Does this variant need a line walkthrough\?/g)||[]).length));
await shot('w8-variants');
await p.locator('[data-act="lw-require"][data-v="V1"]').click(); await p.waitForTimeout(250);
ok('choosing required reveals the candidate transactions for THAT variant',
   (await txt()).includes('SO-24188') && !(await txt()).includes('SO-24310'));
await p.click('[data-act="pick-txn"][data-id="SO-24188"]'); await p.waitForTimeout(300);
ok('picking the transaction enters its trace', await has('SO-24188'));
await shot('w9-trace-step');
for (let i=0;i<7;i++){ await p.keyboard.press('Enter'); await p.waitForTimeout(220); }
ok('seven Enters trace the whole path and land on the summary, unconcluded',
   await p.evaluate(() => window.__st.traceProgress('SO-24188').pending.length === 0
                       && !window.__st.traceProgress('SO-24188').concluded));
const t2 = await txt();
ok('the summary names the exception', t2.toLowerCase().includes('exception'));
ok('and says cash receipt has not happened yet', t2.toLowerCase().includes('not yet occurred'));
await shot('w10-trace-result');
await p.click('[data-act="conclude-trace"]'); await p.waitForTimeout(350);
ok('concluding points at the finding it raised', await has('Review the finding'));
await shot('w11-trace-concluded');

// 5 — the finding is back in step 4
await p.click('[data-act="nav"][data-href="#/controls"]'); await p.waitForTimeout(350);
ok('step 4 flags the walkthrough finding', await has('line walkthrough'));
await shot('w12-finding-back');

// 6 — Testing: scope first
await p.evaluate(() => { const A=window.__act, st=window.__st;
  st.findingSummary().queue.slice().forEach(f => A.decideFinding(f.id, 'confirmed'));
  A.setWalkthroughRequirement('V2','required');
  A.pickTransaction('SO-24310');
  st.traceProgress('SO-24310').txn.steps.forEach(s => A.decideTrace('SO-24310', s.id, s.suggested));
  A.concludeTrace('SO-24310');
  A.setWalkthroughRequirement('V3','not_required','Recognised on a time basis; tested substantively.');
  location.hash = '#/testing'; });
await p.waitForTimeout(350);
const t3 = await txt();
ok('testing leads with the scope decision', t3.includes('Which key controls will be tested'));
ok('and does not show a test before one is scoped', !t3.toLowerCase().includes('population and selection'));
await shot('w13-testing-scope');
await p.evaluate(() => window.__act.setTestScope('C-04','required')); await p.waitForTimeout(300);
ok('scoping C-04 reveals the worked test', await has('Population and selection'));
await p.click('[data-act="extend-sample"]'); await p.waitForTimeout(300);
const t4 = await txt();
ok('extending says a conclusion is still required', t4.toLowerCase().includes('still required'));
ok('and the step is not satisfied', await p.evaluate(() => window.__st.testingSatisfied()) === false);
await shot('w14-testing-extended');
await p.click('[data-act="conclude-test"][data-d="no_rely"]'); await p.waitForTimeout(300);
ok('do not rely records the conclusion', await p.evaluate(() => window.__S.testConclusion) === 'no_rely');
ok('but the step is still open while other key controls have no scope decision',
   await p.evaluate(() => window.__st.testingSatisfied()) === false,
   'deferred=' + await p.evaluate(() => window.__st.testingScope().deferred.length));

// 7 — Complete: stateful sign-off
await p.evaluate(() => { const A=window.__act, st=window.__st;
  st.testingScope().rows.slice().forEach(r => { if (st.testScopeFor(r.control.id).state === 'deferred')
    A.setTestScope(r.control.id,'not_required','No reliance planned; covered substantively.'); });
  st.coverageSummary().mandatoryOpen.slice().forEach(i =>
    i.facts.forEach(f => A.recordAnswer(i.id, f.key, 'Established during the interview.')));
  st.openItemSummary().live.slice().forEach(i => A.setItem(i.id,'resolved'));
  location.hash = '#/complete'; });
await p.waitForTimeout(350);
ok('complete says ready to sign', (await p.locator('h1').first().innerText()).includes('ready to sign'),
   'open gates: ' + JSON.stringify(await p.evaluate(() => window.__st.gateStates().filter(g => !g.signature && !g.ok).map(g => g.id + ': ' + g.detail))));
await shot('w15-ready-to-sign');
await p.locator('[data-act="sign-preparer"]').first().click(); await p.waitForTimeout(300);
ok('signing gives ready for review, not complete', (await p.locator('h1').first().innerText()).includes('ready for review'));
await p.click('[data-act="submit-review"]'); await p.waitForTimeout(300);
ok('submitting shows the reviewer actions', await has('Acting as the reviewer'));
await shot('w16-submitted');
await p.click('[data-act="reviewer"][data-d="approved"]'); await p.waitForTimeout(300);
ok('approval completes it', (await p.locator('h1').first().innerText()).includes('complete'));
await shot('w17-complete');

// 8 — the demo
await p.evaluate(() => { window.__act.reset(); }); await p.waitForTimeout(300);
await p.evaluate(() => window.__demoStart()); await p.waitForTimeout(400);
let beats = 0;
for (let i=0;i<11;i++){ await p.keyboard.press('ArrowRight'); await p.waitForTimeout(i===4?4000:400); beats++; }
ok('the demo runs all twelve beats', (await p.locator('.demo__n').innerText()) === '12/12', await p.locator('.demo__n').innerText());
await shot('w18-demo-last');

console.log('\n--- runtime errors:', errs.length ? errs.join('\n') : 'none');
console.log('--- FAILURES:', fails);
await b.close();
