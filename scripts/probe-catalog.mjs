import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const apiCalls = [];
page.on('response', async (r) => {
  const u = r.url();
  if (!u.includes('johnpye')) return;
  const ct = r.headers()['content-type'] || '';
  if (ct.includes('json') || /api|Lot|Event|SignalR|hub/i.test(u)) {
    let body = '';
    try {
      if (ct.includes('json') && r.status() === 200) body = (await r.text()).slice(0, 300);
    } catch {}
    apiCalls.push({ status: r.status(), ct: ct.slice(0, 30), url: u, body });
  }
});

await page.goto('https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(3000);

const catalogLots = await page.evaluate(() => {
  const items = [];
  for (const a of document.querySelectorAll('a[href*="/Event/LotDetails/"]')) {
    const href = a.getAttribute('href');
    const id = href.match(/LotDetails\/(\d+)/)?.[1];
    if (!id) continue;
    const card = a.closest('.galleryItem, .lot-item, .panel, [class*="lot"], [class*="gallery"]') || a.parentElement?.parentElement?.parentElement;
    const cardText = card?.innerText?.replace(/\s+/g, ' ').trim() || a.innerText.replace(/\s+/g, ' ').trim();
    const lotNum = cardText.match(/Lot\s+#?\s*(\d+)/i)?.[1];
    const price = cardText.match(/£([\d,]+\.?\d*)/)?.[1];
    const time = cardText.match(/(\d+\s+Hours?,?\s+\d+\s+Minutes?|\d+\s+Days?)/i)?.[0];
    items.push({ id, lotNum, price, time, cardText: cardText.slice(0, 180) });
  }
  const byId = new Map();
  for (const it of items) if (it.lotNum || it.price) byId.set(it.id, it);
  return [...byId.values()];
});
console.log('catalog lots with data:', catalogLots.length, catalogLots.slice(0, 3));

const allIds = await page.evaluate(() =>
  [...new Set([...document.querySelectorAll('a[href*="/Event/LotDetails/"]')].map((a) => a.getAttribute('href').match(/LotDetails\/(\d+)/)?.[1]).filter(Boolean))]
);
console.log('unique lot ids on event page:', allIds.length);

// try Event/Lots URL variants
for (const path of [
  '/Event/Lots/530615923?page=1&pageSize=50',
  '/Event/Lots/530615923',
  '/Event/Catalog/530615923',
]) {
  const r = await page.goto(`https://www.johnpyeauctions.co.uk${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
  console.log(path, '->', page.url(), (await page.title()).slice(0, 40));
}

console.log('\napi calls:', apiCalls.slice(0, 20));
await browser.close();
