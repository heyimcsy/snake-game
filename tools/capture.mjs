// Captures screenshots of each screen for visual review.
import puppeteer from "puppeteer-core";
import { STAGES } from "../src/game/stages.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APP_URL = "http://localhost:4173/";
const dir = new URL("./", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 820, deviceScaleFactor: 2 });
  await page.goto(APP_URL, { waitUntil: "networkidle0" });

  // 1. start screen
  await page.waitForSelector(".primary-btn.big");
  await sleep(200);
  await page.screenshot({ path: dir + "shot-1-start.png" });

  // 2. stage select
  await page.click(".primary-btn.big");
  await page.waitForSelector(".stage-grid");
  await sleep(150);
  await page.screenshot({ path: dir + "shot-2-select.png" });

  // pick stage index 2 (id 3) — 4x4 with 8 walls, good to show walls
  const cells = await page.$$(".stage-cell:not(.locked)");
  // stage 1 only unlocked at first run; click stage 1 then we'll navigate stage 3 via cheating
  await cells[0].click();
  await page.waitForSelector(".board");
  await sleep(150);

  // draw a partial path (first ~55% of the solution) to show the trail + head
  const stage = STAGES[0];
  const N = stage.size;
  const rect = await page.evaluate(() => {
    const b = document.querySelector(".board");
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const pt = (r, c) => ({
    x: rect.x + ((c + 0.5) / N) * rect.width,
    y: rect.y + ((r + 0.5) / N) * rect.height,
  });
  const cut = Math.ceil(stage.solution.length * 0.55);
  const f = pt(stage.solution[0][0], stage.solution[0][1]);
  await page.mouse.move(f.x, f.y);
  await page.mouse.down();
  for (let i = 1; i < cut; i++) {
    const [r, c] = stage.solution[i];
    const p = pt(r, c);
    await page.mouse.move(p.x, p.y, { steps: 2 });
    await sleep(20);
  }
  await page.mouse.up();
  await sleep(300);
  await page.screenshot({ path: dir + "shot-3-midgame.png" });

  await browser.close();
  console.log("captured start / select / midgame");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
