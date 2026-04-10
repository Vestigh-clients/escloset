import { chromium } from "@playwright/test";
import process from "node:process";

const baseUrl = process.env.PREVIEW_URL || "http://localhost:4173";
const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const paths = (process.env.HYDRATION_PATHS || "/,/shop,/shop/alo-embroidered-t-shirt,/about,/contact")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

const hydrationPatterns = [
  /hydration/i,
  /did not match/i,
  /text content does not match/i,
  /expected server html/i,
  /error while hydrating/i,
];

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
const failures = [];

page.on("console", (message) => {
  if (!["error", "warning"].includes(message.type())) {
    return;
  }

  const text = message.text();
  if (hydrationPatterns.some((pattern) => pattern.test(text))) {
    failures.push(text);
  }
});

for (const path of paths) {
  failures.length = 0;
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  if (!response || response.status() >= 400) {
    throw new Error(`${path} returned ${response?.status() ?? "no response"}`);
  }

  if (failures.length > 0) {
    throw new Error(`${path} emitted hydration warnings:\n${failures.join("\n")}`);
  }

  console.log(`${path}: no hydration warnings`);
}

await browser.close();
