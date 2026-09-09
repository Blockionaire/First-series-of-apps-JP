import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1560, height: 980 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('http://localhost:8765/index.html#/'); await p.waitForTimeout(500);

const routes = ['#/', '#/engagement', '#/revenue', '#/prepare', '#/interview', '#/understanding',
  '#/controls', '#/trace', '#/testing', '#/complete', '#/resolve', '#/matrix', '#/questionnaire', '#/cockpit'];
for (const r of routes) {
  await p.evaluate(x => { location.hash = x; }, r);
  await p.waitForTimeout(180);
  const h = await p.locator('h1').first().innerText().catch(() => '(no h1)');
  console.log(r.padEnd(18), '|', h.replace(/\n/g,' ').slice(0, 60));
}
console.log('--- route integrity:', JSON.stringify(await p.evaluate(() => window.__checkRoutes())));
console.log('--- errors:', errs.length ? errs.join('\n') : 'none');
await b.close();
