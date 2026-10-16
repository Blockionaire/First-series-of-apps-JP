const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = ['Huisje OVS app final version.html', 'Huisje OVS app final version .html'];
const files = new Set([...pages, 'renovation-access.js', 'renovation-access.css']);
const owner = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1));
  if (!files.has(name)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(path.join(root, name)));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
  let passed = 0;
  try {
    for (const name of pages) {
      async function open(config = {}, mobile = false) {
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
        await context.route('https://**/*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await context.addInitScript(cfg => {
          window.testAccess = { allowed: true, ...cfg };
          window.testCalls = { rpc: 0, rows: 0, writes: 0, removed: 0 };
          if (!sessionStorage.getItem('fixture-initialized')) {
            sessionStorage.setItem('fixture-initialized', '1');
            if (cfg.user) localStorage.setItem('ovs-private-session', JSON.stringify(cfg.user));
          }
          let authChanged;
          const channel = { on() { return this; }, subscribe(cb) { cb('SUBSCRIBED'); return this; }, unsubscribe() {} };
          window.supabase = { createClient() { return {
            auth: {
              async getUser() { return { data: { user: JSON.parse(localStorage.getItem('ovs-private-session') || 'null') }, error: null }; },
              async signInWithPassword(credentials) {
                if (credentials.password !== 'correct-password') return { error: { message: 'fixture bad password' } };
                localStorage.setItem('ovs-private-session', JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', is_anonymous: false }));
                return { error: null };
              },
              onAuthStateChange(callback) { authChanged = callback; return { data: { subscription: { unsubscribe() {} } } }; },
              async signOut() { return { error: { message: 'fixture offline signout' } }; },
            },
            async rpc(name) {
              if (name !== 'ovs_can_access') throw Error('Unexpected RPC');
              window.testCalls.rpc++;
              return { data: window.testAccess.allowed, error: window.testAccess.missing ? { code: 'PGRST202' } : null };
            },
            from(name) {
              if (name !== 'ovs_state') throw Error('Unexpected table');
              window.testCalls.rows++;
              const query = { select() { return this; }, eq() { return this; }, async single() { return { data: null, error: null }; }, async upsert() { window.testCalls.writes++; return { error: null }; } };
              return query;
            },
            channel() { return channel; },
            async removeAllChannels() { window.testCalls.removed++; },
          }; } };
          window.testSignOutEvent = () => authChanged('SIGNED_OUT');
        }, config);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/' + encodeURIComponent(name));
        await page.waitForFunction(() => document.querySelector('#ovs-access form'));
        return { context, page, errors };
      }
      async function locked(a) {
        await a.page.waitForFunction(() => !document.body.hasAttribute('data-ovs-unlocked'));
        assert.equal(await a.page.evaluate(() => window.testCalls.rows), 0);
        assert.equal(await a.page.evaluate(() => window.testCalls.writes), 0);
        assert.deepEqual(a.errors, []);
      }
      let a = await open({}, true);
      await locked(a);
      assert.equal(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await a.page.screenshot({ path: process.env.RENOVATION_SCREENSHOT || '/tmp/renovation-access-mobile.png' });
      await a.page.locator('input[name=email]').fill('tester@example.test');
      await a.page.locator('input[name=password]').fill('incorrect');
      await a.page.getByRole('button', { name: 'Inloggen', exact: true }).click();
      await a.page.getByRole('status').filter({ hasText: 'Inloggen is niet gelukt' }).waitFor();
      await locked(a);
      await a.page.locator('input[name=password]').fill('correct-password');
      await a.page.getByRole('button', { name: 'Inloggen', exact: true }).click();
      await a.page.waitForFunction(() => document.body.hasAttribute('data-ovs-unlocked'));
      assert((await a.page.evaluate(() => window.testCalls.rows)) > 0);
      assert.deepEqual(a.errors, []);
      await a.page.getByRole('button', { name: 'Uitloggen', exact: true }).click();
      await a.page.waitForFunction(() => document.querySelector('#ovs-access form') && !localStorage.getItem('ovs-private-session'));
      assert.equal(await a.page.evaluate(() => localStorage.getItem('ovs-v16')), null);
      await a.context.close(); passed++;
      for (const config of [{ user: owner, allowed: false }, { user: owner, missing: true }, { user: { ...owner, is_anonymous: true } }]) {
        a = await open(config); await locked(a); await a.context.close(); passed++;
      }
      a = await open({ user: owner });
      await a.page.waitForFunction(() => document.body.hasAttribute('data-ovs-unlocked'));
      await a.page.evaluate(() => { window.testAccess.allowed = false; dispatchEvent(new Event('focus')); });
      await a.page.waitForFunction(() => !document.body.hasAttribute('data-ovs-unlocked'));
      const writes = await a.page.evaluate(() => window.testCalls.writes);
      await a.page.evaluate(() => supabaseSave({ forbidden: true }));
      assert.equal(await a.page.evaluate(() => window.testCalls.writes), writes);
      assert((await a.page.evaluate(() => window.testCalls.removed)) > 0);
      assert.deepEqual(a.errors, []);
      await a.context.close(); passed++;
      console.log('PASS:', name, 'login, rejection, missing setup, guest denial, revocation and logout');
    }
    console.log('PASS:', passed, 'browser scenarios; mobile layout and actual pages verified with explicit Auth/database fixtures');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
