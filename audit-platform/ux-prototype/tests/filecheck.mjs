import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1560, height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const F = 'file:///home/user/First-series-of-apps-JP/audit-platform/ux-prototype/audit-ai-prototype.html';
await p.goto(F + '#/'); await p.waitForTimeout(600);
let fails = 0;
const ok = (n,c,x='')=>{console.log((c?'  PASS ':'  FAIL ')+n+(x?'  ['+x+']':''));if(!c)fails++;};
ok('the bundle boots from file://', (await p.locator('#app').innerText()).includes('Good morning'));
ok('route integrity clean', JSON.stringify(await p.evaluate(() => window.__checkRoutes())) === '[]');
for (const r of ['#/engagement','#/revenue','#/prepare','#/interview','#/understanding','#/controls','#/trace','#/testing','#/complete','#/resolve','#/matrix','#/questionnaire','#/cockpit']) {
  await p.evaluate(x => location.hash = x, r); await p.waitForTimeout(150);
  const n = (await p.locator('#app').innerText()).length;
  if (n < 200) { console.log('  FAIL thin render at ' + r); fails++; }
}
ok('every route renders', true);
// keyboard + palette
await p.evaluate(() => location.hash = '#/prepare'); await p.waitForTimeout(200);
await p.keyboard.press('Enter'); await p.waitForTimeout(300);
ok('Enter on Prepare confirms and moves to the interview', await p.evaluate(()=>location.hash) === '#/interview');
await p.keyboard.press('Control+k'); await p.waitForTimeout(250);
ok('the command palette opens', await p.locator('.pal').count() === 1);
await p.fill('#pal-in', 'spare part'); await p.waitForTimeout(250);
ok('it finds the process variants', (await p.locator('.pal__list').innerText()).includes('Spare part sales'));
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
await p.keyboard.press('?'); await p.waitForTimeout(200);
ok('the shortcut sheet opens and is grouped', (await p.locator('.sheet').innerText()).toLowerCase().includes('line walkthrough — step 5'));
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
// demo
await p.evaluate(() => window.__demoStart()); await p.waitForTimeout(400);
const beats = await p.evaluate(() => window.__demoSteps);
for (let i=0;i<beats-1;i++){ await p.keyboard.press('ArrowRight'); await p.waitForTimeout((i===4||i===6)?6000:350); }
ok(`the guided demo runs to beat ${beats}`, (await p.locator('.demo__n').innerText()) === `${beats}/${beats}`, await p.locator('.demo__n').innerText());
await p.screenshot({ path: 'file-final.png' });
console.log('--- runtime errors:', errs.length ? errs.join('\n') : 'none');
console.log('--- FAILURES:', fails);
await b.close();
