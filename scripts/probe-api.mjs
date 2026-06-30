import { createSession, loadPage } from '../server/johnpyeBrowser.js';

const { page, context } = await createSession();
await loadPage(page, 'https://www.johnpyeauctions.co.uk/');
await loadPage(
  page,
  'https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items'
);

const cards = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('[class*="awe-rt"], .galleryItem, .lot')) {
    const cls = el.className;
    const text = el.innerText?.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (/£|Hours|Lot/i.test(text)) out.push({ cls: String(cls).slice(0, 80), text });
  }
  return out.slice(0, 8);
});
console.log('awe cards', cards);

const posts = await page.evaluate(() => {
  const html = document.documentElement.innerHTML;
  return [...html.matchAll(/\$\.(?:post|get)\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
});
console.log('jquery endpoints', [...new Set(posts)]);

const BASE = 'https://www.johnpyeauctions.co.uk';
const rt = await page.request.post(`${BASE}/RealTime/GetNextLotClosing`, {
  form: { eventId: '530615923' },
});
console.log('GetNextLotClosing', rt.status(), await rt.text());

await context.close();
process.exit(0);
