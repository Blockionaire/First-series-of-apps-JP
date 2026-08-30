import { chromium } from "playwright";

const OUT = process.argv[2] ?? ".";
const BASE = "http://localhost:3100";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// Light-theme context: preset the cookie so SSR renders light from the first byte.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "stai_theme", value: "light", url: BASE }]);
const page = await ctx.newPage();

async function shot(name, full = true) {
  if (full) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    });
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("✓", name);
}

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await shot("L1-home");
await page.goto(BASE + "/briefing", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await shot("L2-briefing-radar", false);
await page.goto(BASE + "/briefing/isa-240-synthetic-evidence", { waitUntil: "networkidle" });
await shot("L3-article");
await page.goto(BASE + "/prompts", { waitUntil: "networkidle" });
await shot("L4-prompts");
await page.goto(BASE + "/plus", { waitUntil: "networkidle" });
await shot("L5-plus");
await page.goto(BASE + "/training", { waitUntil: "networkidle" });
await shot("L6-training");
await page.goto(BASE + "/ask", { waitUntil: "networkidle" });
await page.fill("#ask-input", "What does ISQM 1 require for our AI tools?");
await page.click("form button[type=submit]");
await page.waitForTimeout(4500);
await shot("L7-ask", false);

// live toggle check: flip from the system bar on the homepage
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.click("button[aria-label='Switch to dark theme']");
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/L8-toggled-back-dark.png` });
console.log("✓ L8-toggled-back-dark");

// mobile light
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
await mob.addCookies([{ name: "stai_theme", value: "light", url: BASE }]);
const m = await mob.newPage();
await m.goto(BASE + "/", { waitUntil: "networkidle" });
await m.waitForTimeout(800);
await m.screenshot({ path: `${OUT}/L9-mobile-light.png` });
console.log("✓ L9-mobile-light");

await browser.close();
