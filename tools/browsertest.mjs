// Drives the real built app in headless Chrome: start -> pick stage 1 ->
// draw the solution path with real pointer/mouse moves -> assert the win banner.
import puppeteer from "puppeteer-core";
import { STAGES } from "../src/game/stages.js";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APP_URL = process.env.URL || "http://localhost:4173/";
const SHOT = new URL("./shot-win.png", import.meta.url).pathname;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function playStage(page, stageIndex) {
  const stage = STAGES[stageIndex];
  const N = stage.size;

  // board rect in page coordinates
  const rect = await page.evaluate(() => {
    const b = document.querySelector(".board");
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  // full-board mapping (matches cellFromEvent, padding included)
  const pt = (r, c) => ({
    x: rect.x + ((c + 0.5) / N) * rect.width,
    y: rect.y + ((r + 0.5) / N) * rect.height,
  });

  const first = pt(stage.solution[0][0], stage.solution[0][1]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (let i = 1; i < stage.solution.length; i++) {
    const [r, c] = stage.solution[i];
    const p = pt(r, c);
    await page.mouse.move(p.x, p.y, { steps: 2 });
    await sleep(6);
  }
  await page.mouse.up();
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 820, deviceScaleFactor: 2 });

  const logs = [];
  page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto(APP_URL, { waitUntil: "networkidle0" });

  // start -> select
  await page.waitForSelector(".primary-btn.big");
  await page.click(".primary-btn.big");
  await page.waitForSelector(".stage-grid");

  // pick stage 1
  await page.waitForSelector(".stage-cell:not(.locked)");
  await page.click(".stage-cell:not(.locked)");
  await page.waitForSelector(".board");
  await sleep(150);

  // play the embedded solution for stage 1
  await playStage(page, 0);

  // expect the win card
  let won = false;
  try {
    await page.waitForSelector(".win-card", { timeout: 4000 });
    won = true;
  } catch {
    won = false;
  }

  const progress = await page.evaluate(() => {
    const pills = [...document.querySelectorAll(".pill")].map((p) => p.textContent);
    const winText = document.querySelector(".win-card h2")?.textContent || null;
    return { pills, winText };
  });

  await page.screenshot({ path: SHOT });

  // also verify a wrong move is blocked: reset via reload and try stepping onto
  // number 3 before 2 is impossible — instead check that drawing across a wall
  // is refused on stage 2. (light check)
  console.log("WIN:", won);
  console.log("PROGRESS:", JSON.stringify(progress));
  if (logs.length) console.log("PAGE LOGS:\n" + logs.join("\n"));

  await browser.close();
  process.exit(won ? 0 : 2);
})().catch((e) => {
  console.error("test error:", e);
  process.exit(3);
});
