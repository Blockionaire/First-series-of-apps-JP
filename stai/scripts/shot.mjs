import { chromium } from "playwright";

const [, , url = "http://localhost:3100/", out = "shot.png", width = "1440", full = "full"] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: parseInt(width), height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle" });
// scroll through so IntersectionObserver reveals fire before a full-page capture
await page.evaluate(async () => {
  const step = 700;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 90));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(900);
await page.screenshot({ path: out, fullPage: full === "full" });
await browser.close();
console.log("saved", out);
