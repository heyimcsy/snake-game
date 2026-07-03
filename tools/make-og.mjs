// Renders tools/og-image.html to public/og.png (1200×630) with headless Chrome.
// Regenerate with: node tools/make-og.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SRC = "file://" + join(__dirname, "og-image.html");
const OUT_DIR = join(__dirname, "..", "public");
const OUT = join(OUT_DIR, "og.png");

mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--force-color-profile=srgb"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(SRC, { waitUntil: "networkidle0" });
await page.screenshot({
  path: OUT,
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
console.log("wrote", OUT);
