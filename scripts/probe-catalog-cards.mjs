import { createSession, loadPage } from '../server/johnpyeBrowser.js';

const { page, context } = await createSession();
await loadPage(page, 'https://www.johnpyeauctions.co.uk/');
await loadPage(
  page,
  'https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items'
);

const lots = await page.evaluate(() => {
  const items = [];
  for (const a of document.querySelectorAll('a[href*="/Event/LotDetails/"]')) {
    const href = a.getAttribute('href');
    const lotId = href.match(/LotDetails\/(\d+)/)?.[1];
    if (!lotId) continue;
    const card =
      a.closest('.galleryItem') ||
      a.closest('[class*="lot"]') ||
      a.closest('.panel') ||
      a.parentElement?.parentElement?.parentElement?.parentElement;
    if (!card) continue;
    const lotNum = card.innerText.match(/Lot\s+#?\s*(\d+)/i)?.[1];
    const priceEl = card.querySelector('.awe-rt-CurrentPrice');
    const price = priceEl?.textContent?.replace(/[£,]/g, '').trim();
    const timeEl =
      card.querySelector('[class*="Time"]') ||
      card.querySelector('[class*="time"]') ||
      card.querySelector('.awe-rt-RemainingTime') ||
      card.querySelector('.awe-rt-TimeRemaining');
    const remaining = timeEl?.textContent?.trim();
    const titleLink = card.querySelector('a[href*="/Event/LotDetails/"] h5, a[href*="/Event/LotDetails/"]');
    let title = '';
    for (const h of card.querySelectorAll('h5, h4, a')) {
      const t = h.textContent.replace(/\s+/g, ' ').trim();
      if (t.length > 10 && !/^Lot\s/i.test(t) && !/Hours/i.test(t)) {
        title = t;
        break;
      }
    }
    if (!title) title = a.textContent.replace(/\s+/g, ' ').replace(/Lot\s+\d+.*/i, '').trim();
    items.push({
      lotId,
      lotNum,
      price,
      remaining,
      title: title.slice(0, 100),
      cardClasses: card.className?.slice?.(0, 60),
      cardSnippet: card.innerText.replace(/\s+/g, ' ').slice(0, 180),
    });
  }
  const byId = new Map();
  for (const it of items) {
    if (!byId.has(it.lotId) || it.price) byId.set(it.lotId, it);
  }
  return [...byId.values()].slice(0, 8);
});
console.log(JSON.stringify(lots, null, 2));

const timeClasses = await page.evaluate(() => {
  return [...document.querySelectorAll('[class*="Remaining"], [class*="Time"], [class*="End"]')]
    .filter((el) => /hour|minute|day|time/i.test(el.className + el.textContent))
    .slice(0, 15)
    .map((el) => ({ cls: el.className, text: el.textContent.replace(/\s+/g, ' ').slice(0, 60) }));
});
console.log('time elements', timeClasses);

await context.close();
