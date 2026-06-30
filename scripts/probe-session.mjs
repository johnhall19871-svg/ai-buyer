import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'en-GB',
});
const page = await context.newPage();

async function waitForSite() {
  for (let i = 0; i < 20; i++) {
    const html = await page.content();
    if (!html.includes('Just a moment') && !html.includes('cf-challenge')) return true;
    await page.waitForTimeout(1500);
  }
  return false;
}

async function load(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  return waitForSite();
}

await load('https://www.johnpyeauctions.co.uk/');
console.log('home ok', page.url());

const eventUrl =
  'https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items';
await load(eventUrl);
console.log('event ok', page.url(), await page.title());

const html = await page.content();
console.log('html len', html.length, 'cf?', html.includes('Just a moment'));

const lotLinks = [...html.matchAll(/href="(\/Event\/LotDetails\/\d+\/[^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(lotLinks)];
console.log('lot links', unique.length, unique.slice(0, 3));

// parse inline JSON / scripts
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((m) => m[1])
  .filter((s) => /lot|bid|price|remaining|ends/i.test(s) && s.length < 50000);
console.log('interesting scripts', scripts.length);
for (const s of scripts.slice(0, 3)) {
  console.log('--- script sample ---\n', s.slice(0, 500));
}

// load one lot
if (unique[0]) {
  await load(`https://www.johnpyeauctions.co.uk${unique[0]}`);
  const lotText = await page.innerText('body');
  const price = lotText.match(/Current Price £([\d,]+\.?\d*)/)?.[1];
  const minBid = lotText.match(/Minimum Bid £([\d,]+\.?\d*)/)?.[1];
  const remaining = lotText.match(/Remaining Time ([^\n]+)/)?.[1];
  const title = lotText.match(/\n\n([^\n]+)\n\nShipping Options/)?.[1] || lotText.match(/Lot # \d+\nnext \nCurrent Price[^\n]+\n[^\n]+\n[^\n]+\nRemaining Time[^\n]+\n\n\n([^\n]+)/)?.[1];
  console.log({ price, minBid, remaining, title: title?.slice(0, 100) });
}

await browser.close();
