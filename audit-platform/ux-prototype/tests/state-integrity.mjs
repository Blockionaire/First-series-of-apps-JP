import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1560, height: 980 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(400);

let fails = 0;
const ok = (name, cond, extra='') => { console.log((cond?'  PASS ':'  FAIL ') + name + (extra?'  ['+extra+']':'')); if(!cond) fails++; };
const E = (fn, ...a) => p.evaluate(fn, ...a);
const reset = () => E(() => { window.__act.reset(); });
// Step 3 only: the process is documented, nothing is analysed.
const gen = async () => {
  await E(() => { window.__S.prepared = true; window.__S.generated = true; window.__S.genSeen = true; window.__st.commit(); });
};
// Steps 3 and 4: the understanding is reviewed and the analysis has run.
const analysed = async () => {
  await gen();
  await E(() => { window.__S.analysed = true; window.__S.anaSeen = true; window.__st.commit(); });
};

// ---------- Case A: contradiction resolution propagates ----------
console.log('\nCase A — one contradiction resolution updates statement, fact, coverage, open item, gate');
await reset(); await gen();
let before = await E(() => ({
  contradictoryFacts: window.__st.coverageSummary().facts.contradictory,
  gate: window.__st.gateStates().find(g => g.id === 'contradiction').ok,
  item: window.__st.itemState({ id: 'OI-01', state: 'open' }),
}));
ok('starts with a contradictory fact', before.contradictoryFacts > 0, 'n=' + before.contradictoryFacts);
ok('contradiction gate starts unmet', before.gate === false);
await E(() => window.__act.resolveConflict('N6.2', 'controller', 'Credit control sets and changes all credit limits.'));
let after = await E(() => ({
  contradictoryFacts: window.__st.coverageSummary().facts.contradictory,
  gate: window.__st.gateStates().find(g => g.id === 'contradiction').ok,
  item: window.__st.itemState({ id: 'OI-01', state: 'open' }),
  claim: window.__st.claimState(window.__st.claimById('N6.2')),
  cov: window.__st.covState(window.__st.allItems().find(i => i.id === 'R3.1')),
}));
ok('statement is now edited/resolved', after.claim === 'edited', after.claim);
ok('the two facts settle', after.contradictoryFacts === 0);
ok('coverage area R3.1 moves off open', ['covered','partial'].includes(after.cov), after.cov);
ok('open item OI-01 resolves', after.item === 'resolved', after.item);
ok('contradiction gate now met', after.gate === true);

console.log('\nCase A2 — left unresolved carries forward and the gate stays blocked');
await reset(); await gen();
await E(() => window.__act.resolveConflict('N6.2', 'unresolved', 'Both accounts are recorded; the difference is unresolved.'));
let a2 = await E(() => ({
  gate: window.__st.gateStates().find(g => g.id === 'contradiction').ok,
  item: window.__st.itemState({ id: 'OI-01', state: 'open' }),
  carry: window.__S.itemCarry['OI-01'],
}));
ok('gate stays blocked', a2.gate === false);
ok('open item is carried forward', a2.item === 'carried_forward', a2.item);
ok('carry records a destination and a reason', !!(a2.carry && a2.carry.destination && a2.carry.reason), JSON.stringify(a2.carry));

// ---------- Case B: undecided control is not a conclusion ----------
console.log('\nCase B — undecided is not a conclusion');
await reset(); await analysed();
const cid = await E(() => window.__st.controlSummary().queue[0].id);
await E((id) => window.__act.parkControl(id), cid);
let bres = await E((id) => ({
  pending: window.__st.controlSummary().pending,
  inQueue: window.__st.controlSummary().queue.some(c => c.id === id),
  gate: window.__st.gateStates().find(g => g.id === 'controls').ok,
  decision: window.__S.controlDecisions[id],
}), cid);
ok('parked control keeps state "undecided"', bres.decision === 'undecided');
ok('parked control stays in the queue', bres.inQueue === true);
ok('controls gate stays unmet', bres.gate === false);
await E((id) => window.__act.carryControl(id, 'The control owner is on leave until the final audit.'), cid);
let bres2 = await E((id) => ({
  inQueue: window.__st.controlSummary().queue.some(c => c.id === id),
  carried: window.__st.controlSummary().carriedForward,
  reason: window.__S.controlCarry[id],
}), cid);
ok('carrying forward removes it from the queue', bres2.inQueue === false);
ok('the reason is stored', !!bres2.reason, bres2.reason);
ok('counted as carried forward', bres2.carried === 1);

// ---------- Case C: line walkthrough per variant, and the finding loops back ----------
console.log('\nCase C — per-variant walkthroughs, and step 5 feeding step 4');
await reset(); await analysed();
let c0 = await E(() => { const t = window.__st.traceSummary(); return { undecided: t.undecided, required: t.required, satisfied: t.satisfied }; });
ok('three variants start undecided', c0.undecided === 3, 'undecided=' + c0.undecided);
ok('trace gate not satisfied at the start', c0.satisfied === false);
await E(() => {
  window.__act.setWalkthroughRequirement('V1', 'required');
  window.__act.setWalkthroughRequirement('V2', 'required');
  window.__act.setWalkthroughRequirement('V3', 'not_required', 'Service revenue is recognised on a time basis and is tested substantively.');
});
let c1 = await E(() => { const t = window.__st.traceSummary(); return { required: t.required, satisfied: t.satisfied, undecided: t.undecided }; });
ok('two variants required, one documented as not required', c1.required === 2 && c1.undecided === 0);
ok('still not satisfied — the two required ones are outstanding', c1.satisfied === false);

// trace SO-24188 fully
await E(() => {
  window.__act.pickTransaction('SO-24188');
  const t = window.__st.traceProgress('SO-24188').txn;
  t.steps.forEach(s => window.__act.decideTrace('SO-24188', s.id, s.suggested));
});
let c2 = await E(() => ({
  ex: window.__st.traceProgress('SO-24188').exceptions,
  concluded: window.__st.traceProgress('SO-24188').concluded,
  findingsBefore: window.__st.findingSummary().total,
}));
ok('the machine-sale trace records one exception', c2.ex === 1, 'ex=' + c2.ex);
ok('not concluded until the auditor concludes it', c2.concluded === false);
await E(() => window.__act.concludeTrace('SO-24188'));
let c3 = await E(() => ({
  total: window.__st.findingSummary().total,
  fromTraceOpen: window.__st.findingSummary().fromTraceOpen.length,
  gateFindings: window.__st.gateStates().find(g => g.id === 'findings').ok,
  next: window.__st.nextAction().href,
}));
ok('concluding raises a new finding', c3.total === c2.findingsBefore + 1, `${c2.findingsBefore} -> ${c3.total}`);
ok('the new finding is unconcluded', c3.fromTraceOpen === 1);
ok('the findings gate is blocked by it', c3.gateFindings === false);
// with the interview cleared, the new finding is what the product sends you to
await E(() => {
  const A = window.__act, st = window.__st;
  A.resolveConflict('N6.2', 'controller', 'Credit control sets and changes all credit limits.');
  st.coverageSummary().mandatoryOpen.forEach(i =>
    i.facts.forEach(f => A.recordAnswer(i.id, f.key, 'Established during the interview.')));
  let g = 0;
  while (st.narrativeSummary().pending && g++ < 40) {
    st.claimQueue().forEach(({ b }) => A.saveClaim(b.id, b.suggestion || b.text));
    st.narrativeSummary().pending; 
    const pend = window.__st.narrativeSummary();
    const sections = window.__st.narrativeSummary();
    A.acceptClean();
    const left = st.narrativeSummary();
    if (left.pending) {
      window.__st.narrativeSummary();
      // approve edited-but-clean sections explicitly
      const all = window.__st;
      const remaining = [];
      window.__st.narrativeSummary();
      break;
    }
  }
});
await E(() => {
  const A = window.__act, st = window.__st;
  // approve every section that has no blockers left
  const nar = window.__narrative;
  (nar || []).forEach(sec => { if (st.sectionApprovable(sec)) A.approveSection(sec.id); });
});
let c3b = await E(() => ({ next: window.__st.nextAction().href, t: window.__st.nextAction().t }));
ok('next action points at step 4', c3b.next === '#/controls', c3b.next + ' / ' + c3b.t);

// second variant, and the untraced steps
let c4 = await E(() => {
  window.__act.pickTransaction('SO-24310');
  const t = window.__st.traceProgress('SO-24310').txn;
  return { steps: t.steps.length, untraced: t.untraced.map(u => u.kind) };
});
ok('the spare-part transaction loads its own six steps', c4.steps === 6, 'steps=' + c4.steps);
ok('its untraced steps are both "not applicable to this variant"',
   JSON.stringify(c4.untraced) === '["not_applicable","not_applicable"]', JSON.stringify(c4.untraced));
let c5 = await E(() => ({ notYet: window.__st.traceProgress('SO-24188').txn.untraced.map(u => u.kind) }));
ok('the machine sale records cash receipt as "not yet occurred"',
   JSON.stringify(c5.notYet) === '["not_yet"]', JSON.stringify(c5.notYet));
await E(() => {
  const t = window.__st.traceProgress('SO-24310').txn;
  t.steps.forEach(s => window.__act.decideTrace('SO-24310', s.id, s.suggested));
  window.__act.concludeTrace('SO-24310');
});
let c6 = await E(() => ({ satisfied: window.__st.traceSummary().satisfied, gate: window.__st.gateStates().find(g => g.id === 'trace').ok }));
ok('both required walkthroughs done -> trace gate met', c6.satisfied && c6.gate);

// ---------- Case D: control testing is conditional, extend is not a conclusion ----------
console.log('\nCase D — control testing scope, and extending is not concluding');
await reset(); await analysed();
let d0 = await E(() => ({ keys: window.__st.controlSummary().keyControls.length,
  satisfied: window.__st.testingSatisfied(),
  gate: window.__st.gateStates().some(g => g.id === 'testing') }));
ok('with no key controls the testing gate does not apply', d0.keys === 0 && d0.gate === false);
ok('and step 6 is trivially satisfied', d0.satisfied === true);
await E(() => window.__act.decideControl('C-04', 'key'));
let d1 = await E(() => ({ gate: window.__st.gateStates().some(g => g.id === 'testing'),
  satisfied: window.__st.testingSatisfied(), scopeDecided: window.__st.testingScope().scopeDecided }));
ok('one key control makes the gate applicable', d1.gate === true);
ok('and unsatisfied while the scope is undecided', d1.satisfied === false && d1.scopeDecided === false);
await E(() => window.__act.setTestScope('C-04', 'required'));
await E(() => window.__act.extendSample('C-04'));
let d2 = await E(() => ({ selected: window.__st.testSummary('C-04').selected,
  concluded: window.__st.testSummary('C-04').concluded, satisfied: window.__st.testingSatisfied(),
  ex: window.__st.testSummary('C-04').exceptions }));
ok('extending enlarges the sample to 10', d2.selected === 10, 'n=' + d2.selected);
ok('extending does NOT conclude the test', d2.concluded === false);
ok('and step 6 stays unsatisfied', d2.satisfied === false);
ok('the extension surfaces a second exception', d2.ex === 2, 'ex=' + d2.ex);
await E(() => window.__act.concludeTest('C-04', 'no_rely'));
ok('only rely / do not rely closes it', await E(() => window.__st.testingSatisfied()) === true);

// --- Case D2: one conclusion must never close another control's test ---
console.log('\nCase D2 — two scoped tests cannot be satisfied by one conclusion');
await reset(); await analysed();
await E(() => {
  const A = window.__act;
  A.decideControl('C-04', 'key');
  A.decideControl('C-01', 'key');
  A.setTestScope('C-04', 'required');
  A.setTestScope('C-01', 'required');
});
let x0 = await E(() => ({ keys: window.__st.controlSummary().keyControls.length,
  required: window.__st.testingScope().required.length,
  satisfied: window.__st.testingSatisfied() }));
ok('two controls are key and both scoped for testing', x0.keys === 2 && x0.required === 2);
ok('step 6 starts unsatisfied', x0.satisfied === false);
await E(() => window.__act.concludeTest('C-04', 'no_rely'));
let x1 = await E(() => ({ satisfied: window.__st.testingSatisfied(),
  outstanding: window.__st.testingScope().outstanding.map(r => r.control.id),
  c04: window.__st.controlTest('C-04').conclusion,
  c01: window.__st.controlTest('C-01').conclusion,
  gate: window.__st.gateStates().find(g => g.id === 'testing').ok,
  detail: window.__st.gateStates().find(g => g.id === 'testing').detail }));
ok('C-04 is concluded', x1.c04 === 'no_rely');
ok('C-01 is NOT concluded by it', x1.c01 === null, String(x1.c01));
ok('step 6 REMAINS incomplete', x1.satisfied === false, 'outstanding=' + JSON.stringify(x1.outstanding));
ok('the completion gate stays unmet', x1.gate === false);
ok('the gate names the control that is still outstanding', /C-01/.test(x1.detail), x1.detail);
await E(() => window.__act.concludeTest('C-01', 'rely'));
ok('concluding the second one closes step 6', await E(() => window.__st.testingSatisfied()) === true);
await E(() => window.__act.reopenTest('C-01'));
ok('reopening one control alone reopens step 6', await E(() => window.__st.testingSatisfied()) === false);
ok('and leaves the other conclusion intact', await E(() => window.__st.controlTest('C-04').conclusion) === 'no_rely');
// not-required path
await reset(); await analysed();
await E(() => { window.__act.decideControl('C-04', 'key'); window.__act.setTestScope('C-04', 'not_required', 'No reliance planned; covered substantively.'); });
let d3 = await E(() => ({ satisfied: window.__st.testingSatisfied(), applicable: window.__st.testingScope().applicable }));
ok('"no test required, reason on file" also satisfies step 6', d3.satisfied === true && d3.applicable === false);

// ---------- Case E: questionnaire answers reach the same fact model ----------
console.log('\nCase E — a questionnaire answer becomes evidence');
await reset(); await gen();
let e0 = await E(() => ({ cov: window.__st.covState(window.__st.allItems().find(i => i.id === 'R5.3')),
                          open: window.__st.openItemSummary().open }));
await E(() => window.__act.answerQuestion(13, 'answer', 'Nobody reviews it routinely.'));
let e1 = await E(() => ({
  fact: window.__st.covFacts(window.__st.allItems().find(i => i.id === 'R5.3'))
          .find(f => f.key === 'override_report_reviewer').status,
  item: window.__st.itemState({ id: 'OI-02', state: 'sent' }),
  open: window.__st.openItemSummary().open }));
ok('answering Q13 settles the fact behind coverage area R5.3', e1.fact === 'known', e1.fact);
const ev = await E(() => {
  const f = window.__st.covFacts(window.__st.allItems().find(i => i.id === 'R5.3'))
    .find(x => x.key === 'override_report_reviewer');
  const id = f.refs && f.refs[0];
  const r = id ? window.__refs([id])[0] : null;
  return { id, r, via: f.via, item: window.__st.itemEvidence({ id: 'OI-02' }) };
});
ok('the answer became a real evidence record', !!ev.r && ev.r.kind === 'client_answer', ev.id);
ok('it carries the question, the answer and the respondent',
   !!(ev.r && ev.r.question && ev.r.quote && ev.r.speaker), ev.r && ev.r.speaker);
ok('the fact cites it rather than an unexplained override', ev.via === 'client_questionnaire');
ok('the resolved open item can show the same evidence', JSON.stringify(ev.item) === JSON.stringify([ev.id]));
ok('it appears in the session provenance list',
   await E(() => window.__st.sessionFacts().some(f => f.factKey === 'override_report_reviewer')));
ok('and resolves the open item that was chasing it', e1.item === 'resolved', e1.item);
ok('and does not raise a new open item', e1.open < e0.open, `${e0.open} -> ${e1.open}`);
await E(() => window.__act.answerQuestion(14, 'unknown'));
let e2 = await E(() => ({ open: window.__st.openItemSummary().open,
  ids: window.__st.allOpenItems().filter(i => i.fromQuestionnaire).map(i => i.id) }));
ok('"I don\'t know" raises an open item for the auditor', e2.open === e1.open + 1, JSON.stringify(e2.ids));
await E(() => window.__act.answerQuestion(14, 'call'));
let e3 = await E(() => window.__st.allOpenItems().find(i => i.id === 'QQ-14').title);
ok('"rather have a call" is a different outcome', /call/i.test(e3), e3);
const e4 = await E(() => ({
  fact: window.__st.covFacts(window.__st.allItems().find(i => i.id === 'R9.3'))
    .find(f => f.key === 'consignment_treatment').status,
  evidence: !!window.__refs(['Q:14'])[0]?.thisSession,
}));
ok('a non-answer establishes nothing', e4.fact === 'unknown', e4.fact);
ok('and creates no evidence', e4.evidence === false);

// ---------- Case F: sign-off is stateful ----------
console.log('\nCase F — ready to sign, signed, submitted, reviewed, complete');
await reset();
await E(() => {
  const A = window.__act, S = window.__S, st = window.__st;
  S.prepared = true; S.generated = true; S.genSeen = true; window.__st.commit();
});
await E(() => {
  const A = window.__act, st = window.__st;
  A.resolveConflict('N6.2', 'controller', 'Credit control sets and changes all credit limits.');
  st.claimQueue().slice().forEach(({ b }) => A.saveClaim(b.id, b.suggestion || b.text));
  st.coverageSummary().mandatoryOpen.slice().forEach(i =>
    i.facts.forEach(f => A.recordAnswer(i.id, f.key, 'Established during the interview.')));
});
// approve every section — clean ones in one action, edited ones explicitly
await E(() => {
  const A = window.__act, st = window.__st;
  A.acceptClean();
  (window.__narrative || []).forEach(sec => { if (st.sectionApprovable(sec)) A.approveSection(sec.id); });
});
await E(() => { window.__S.analysed = true; window.__S.anaSeen = true; window.__st.commit(); });
await E(() => {
  const A = window.__act, st = window.__st;
  st.controlSummary().queue.slice().forEach(c => A.decideControl(c.id, c.keyProposal === false ? 'not_key' : 'key'));
  st.findingSummary().queue.slice().forEach(f => A.decideFinding(f.id, 'confirmed'));
  ['V1','V2'].forEach(v => A.setWalkthroughRequirement(v, 'required'));
  A.setWalkthroughRequirement('V3', 'not_required', 'Recognised on a time basis and tested substantively.');
  ['SO-24188','SO-24310'].forEach(id => {
    A.pickTransaction(id);
    st.traceProgress(id).txn.steps.forEach(s => A.decideTrace(id, s.id, s.suggested));
    A.concludeTrace(id);
  });
  st.findingSummary().queue.slice().forEach(f => A.decideFinding(f.id, 'confirmed'));
  st.testingScope().rows.slice().forEach(r => A.setTestScope(r.control.id,
    r.control.id === 'C-04' ? 'required' : 'not_required', 'No reliance planned; covered substantively.'));
  st.testingScope().outstanding.slice().forEach(r => A.concludeTest(r.control.id, 'no_rely'));
  st.openItemSummary().live.slice().forEach(i => A.setItem(i.id, 'resolved'));
});
let f0 = await E(() => ({ state: window.__st.processState().id, work: window.__st.workComplete(),
  open: window.__st.gateStates().filter(g => !g.signature && !g.ok).map(g => g.id) }));
ok('all work gates met', f0.work === true, 'still open: ' + JSON.stringify(f0.open));
ok('process state is "ready"', f0.state === 'ready', f0.state);
await E(() => window.__act.signPreparer());
let f1 = await E(() => ({ state: window.__st.processState().id, label: window.__st.processState().label }));
ok('signing gives "ready for review", not "complete"', f1.state === 'signed' && f1.label === 'Ready for review', f1.label);
await E(() => window.__act.submitForReview());
ok('submitted is its own state', await E(() => window.__st.processState().id) === 'submitted');
await E(() => window.__act.reviewerAction('reopened'));
let f2 = await E(() => ({ state: window.__st.processState().id, preparer: window.__S.signOff.preparer,
  points: window.__st.openReviewPoints().length, canResubmit: window.__st.canResubmit(),
  next: window.__st.nextAction().t }));
ok('reopening is its own state and keeps the preparer signature', f2.state === 'reopened' && f2.preparer === 'signed');
ok('reopening raises a real review point', f2.points === 1, 'points=' + f2.points);
ok('resubmission is blocked while it is open', f2.canResubmit === false);
ok('next action names the review point, not "awaiting review"',
   /review point/i.test(f2.next), f2.next);
await E(() => window.__act.submitForReview());
ok('attempting to resubmit does nothing', await E(() => window.__st.processState().id) === 'reopened');
await E(() => window.__act.answerPoint('RP-01',
  'The Commercial Director route exists in Business Central and is not covered by C-02 as documented. C-02 is reconcluded as not key and the exposure is carried into the risk analysis handover.'));
let f2b = await E(() => ({ points: window.__st.openReviewPoints().length,
  canResubmit: window.__st.canResubmit(),
  response: window.__st.reviewPointById('RP-01').response,
  state: window.__st.reviewPointById('RP-01').state,
  next: window.__st.nextAction().t }));
ok('answering it records the response', !!f2b.response && f2b.state === 'addressed');
ok('and releases the file', f2b.points === 0 && f2b.canResubmit === true);
ok('next action becomes resubmit', /resubmit/i.test(f2b.next), f2b.next);
await E(() => { window.__act.submitForReview(); window.__act.reviewerAction('approved'); });
let f3 = await E(() => ({ state: window.__st.processState().id, next: window.__st.nextAction().t,
  journey: window.__st.journeyStep('complete').s }));
ok('only reviewer approval makes it complete', f3.state === 'complete', f3.state);
ok('journey step 7 shows done', f3.journey === 'done', f3.journey);
ok('next action says Revenue is complete', /complete/i.test(f3.next), f3.next);

console.log('\n--- runtime errors:', errs.length ? errs.join('\n') : 'none');
console.log('--- FAILURES:', fails);
await b.close();
process.exit(fails ? 1 : 0);
