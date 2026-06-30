import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'en-GB',
});
const page = await context.newPage();

async function load(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 15; i++) {
    if (!(await page.content()).includes('Just a moment')) break;
    await page.waitForTimeout(2000);
  }
}

await load('https://www.johnpyeauctions.co.uk/');
const allEvents = await page.$$eval('a[href*="Event/Details"]', (as) => {
  const seen = new Set();
  const out = [];
  for (const a of as) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/Event\/Details\/(\d+)/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ eventId: m[1], href, text: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) });
  }
  return out;
});
console.log('total events:', allEvents.length);
for (const loc of ['Nottingham', 'Chesterfield', 'Birmingham', 'Marchington']) {
  const matches = allEvents.filter((e) => new RegExp(loc, 'i').test(e.href + e.text));
  console.log(loc, 'events:', matches.map((e) => e.eventId + ' ' + e.text.slice(0, 60)));
}

const testEvent = allEvents.find((e) => /Nottingham/i.test(e.href + e.text))?.href;
const url = testEvent.startsWith('http')
  ? testEvent
  : `https://www.johnpyeauctions.co.uk${testEvent}`;
await load(url);

const lots = await page.evaluate(() => {
  const cards = document.querySelectorAll('a[href*="/Event/LotDetails/"]');
  return [...cards].slice(0, 5).map((a) => {
    const href = a.getAttribute('href');
    const id = href.match(/LotDetails\/(\d+)/)?.[1];
    const lotNum = a.textContent.match(/Lot\s+(\d+)/i)?.[1];
    const parent = a.closest('div, li, tr, article') || a.parentElement;
    return {
      id,
      lotNum,
      href,
      text: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 200),
      parentHtml: parent?.innerHTML?.slice(0, 800),
    };
  });
});
console.log('\nSample lots parsed:', JSON.stringify(lots, null, 2));

// check pagination
const pagination = await page.$$eval('a, button', (els) =>
  els
    .filter((el) => /next|page|more/i.test(el.textContent) || el.getAttribute('aria-label')?.match(/next|page/i))
    .map((el) => ({ tag: el.tagName, text: el.textContent.trim().slice(0, 40), href: el.getAttribute('href') }))
    .slice(0, 10)
);
console.log('\nPagination controls:', pagination);

// single lot detail page
if (lots[0]?.href) {
  const lotUrl = lots[0].href.startsWith('http')
    ? lots[0].href
    : `https://www.johnpyeauctions.co.uk${lots[0].href}`;
  await load(lotUrl);
  const detail = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1,h2,h3')?.textContent?.trim(),
    bodySample: document.body.innerText.slice(0, 1200),
  }));
  console.log('\nLot detail:', detail);
  writeFileSync('scripts/lot-detail-sample.txt', detail.bodySample);
}

await browser.close();
