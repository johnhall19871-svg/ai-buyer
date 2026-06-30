import { createSession, loadPage } from '../server/johnpyeBrowser.js';

const { page, context } = await createSession();
await loadPage(page, 'https://www.johnpyeauctions.co.uk/');
await loadPage(
  page,
  'https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items'
);

async function readTimes() {
  return page.evaluate(() =>
    [...document.querySelectorAll('.galleryTime--active, .awe-rt-TimeRemaining, [class*="RemainingTime"]')]
      .map((el) => ({ cls: el.className, text: el.textContent.replace(/\s+/g, ' ').trim() }))
      .filter((x) => x.text.length > 0)
      .slice(0, 10)
  );
}

for (const wait of [0, 3000, 8000, 15000]) {
  if (wait) await page.waitForTimeout(wait);
  const times = await readTimes();
  console.log(`after ${wait}ms:`, times);
}

await context.close();
