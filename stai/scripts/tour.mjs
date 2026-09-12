import { chromium } from "playwright";

const OUT = process.argv[2] ?? ".";
const BASE = "http://localhost:3100";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

async function shot(name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 700);
  if (opts.full) {
    await page.evaluate(async () => {
      const step = 700;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!opts.full });
  console.log("✓", name);
}

// 1. home
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await shot("01-home", { full: true });

// 2. briefing with radar
await page.goto(BASE + "/briefing", { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // let the sweep travel
await shot("02-briefing-radar");

// 3. article
await page.goto(BASE + "/briefing/eu-ai-act-reaches-the-audit-file", { waitUntil: "networkidle" });
await shot("03-article", { full: true });

// 4. ask with a live question (retrieval mode)
await page.goto(BASE + "/ask", { waitUntil: "networkidle" });
await page.fill("#ask-input", "Do we need to keep the prompts our team used on an engagement?");
await page.click("form button[type=submit]");
await page.waitForTimeout(4500);
await shot("04-ask");

// 5. login as plus member, prompt with adapt panel
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.fill("#au-email", "eva@test.eu");
await page.fill("#au-pass", "password123");
await page.click("form button[type=submit]");
await page.waitForTimeout(1500);
await page.goto(BASE + "/prompts/engagement-risk-brainstorm", { waitUntil: "networkidle" });
await page.fill("#ad-client", "Mid-cap listed logistics group, ~€800m revenue");
await page.fill("#ad-sector", "Logistics & transport");
await page.fill("#ad-jur", "Germany");
await page.fill("#ad-fw", "IFRS + ISA");
await shot("05-prompt-adapt", { full: true });

// 6. plus page (logged out for the founding banner CTA) — new context
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE + "/plus", { waitUntil: "networkidle" });
await p2.screenshot({ path: `${OUT}/06-plus.png`, fullPage: true });
console.log("✓ 06-plus");

// 7. assessment result — answer all 8
await p2.goto(BASE + "/assessment", { waitUntil: "networkidle" });
await p2.click("text=Begin the assessment");
for (let i = 0; i < 8; i++) {
  await p2.waitForTimeout(450);
  const opts = await p2.locator('[role=radio]').all();
  await opts[i % 2 === 0 ? 1 : 2].click();
}
await p2.waitForTimeout(900);
await p2.screenshot({ path: `${OUT}/07-assessment-result.png`, fullPage: true });
console.log("✓ 07-assessment-result");

// 8. training
await p2.goto(BASE + "/training", { waitUntil: "networkidle" });
await p2.evaluate(async () => { window.scrollTo(0, 0); });
await p2.screenshot({ path: `${OUT}/08-training.png`, fullPage: true });
console.log("✓ 08-training");

// 9. mobile home + briefing
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
const m = await mob.newPage();
await m.goto(BASE + "/", { waitUntil: "networkidle" });
await m.waitForTimeout(800);
await m.screenshot({ path: `${OUT}/09-mobile-home.png` });
await m.click("button:has-text('Menu')");
await m.waitForTimeout(500);
await m.screenshot({ path: `${OUT}/10-mobile-menu.png` });
console.log("✓ mobile");

await browser.close();
