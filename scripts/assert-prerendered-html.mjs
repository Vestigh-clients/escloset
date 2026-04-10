import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const clientDir = path.join(rootDir, "build", "client");

const readHtml = (relativePath) => {
  const filePath = path.join(clientDir, relativePath);
  if (!existsSync(filePath)) {
    throw new Error(`Missing prerendered file: ${relativePath}`);
  }

  return readFileSync(filePath, "utf8");
};

const assertIncludes = (label, html, expected) => {
  if (!html.includes(expected)) {
    throw new Error(`${label} is missing expected content: ${expected}`);
  }
};

const assertMatches = (label, html, pattern) => {
  if (!pattern.test(html)) {
    throw new Error(`${label} failed assertion: ${pattern}`);
  }
};

const homeHtml = readHtml("index.html");
const shopHtml = readHtml(path.join("shop", "index.html"));

assertIncludes("homepage", homeHtml, "Your Wardrobe");
assertMatches("homepage canonical", homeHtml, /<link rel="canonical" href="https?:\/\//);
assertMatches("homepage OG image", homeHtml, /property="og:image" content="https?:\/\//);
assertIncludes("shop page", shopHtml, "Add to Cart");
assertMatches("shop canonical", shopHtml, /<link rel="canonical" href="https?:\/\//);
assertMatches("shop OG image", shopHtml, /property="og:image" content="https?:\/\//);

const shopDir = path.join(clientDir, "shop");
const productDirs = readdirSync(shopDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (productDirs.length === 0) {
  throw new Error("No prerendered product pages found");
}

const productHtml = productDirs
  .map((slug) => readHtml(path.join("shop", slug, "index.html")))
  .find((html) => html.includes('"@type":"Product"'));

if (!productHtml) {
  throw new Error("No prerendered product page contains Product JSON-LD");
}

assertMatches("product title", productHtml, /<title>[^<]+ - [^<]+<\/title>/);
assertMatches("product canonical", productHtml, /<link rel="canonical" href="https?:\/\/[^"]+\/shop\/[^"]+"/);
assertMatches("product OG image", productHtml, /property="og:image" content="https?:\/\//);
assertIncludes("product JSON-LD", productHtml, '"@type":"Product"');
assertIncludes("product currency", productHtml, '"priceCurrency":"GHS"');

if (!existsSync(path.join(clientDir, "sitemap.xml"))) {
  throw new Error("Missing sitemap.xml");
}

if (!existsSync(path.join(clientDir, "robots.txt"))) {
  throw new Error("Missing robots.txt");
}

if (!existsSync(path.join(clientDir, "__spa-fallback.html"))) {
  throw new Error("Missing __spa-fallback.html");
}

console.log("Prerendered HTML assertions passed");
