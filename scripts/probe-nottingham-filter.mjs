import { createSession, loadPage } from '../server/johnpyeBrowser.js';
import { writeFileSync } from 'fs';

const { page, context } = await createSession();
await loadPage(page, 'https://www.johnpyeauctions.co.uk/');
await loadPage(
  page,
  'https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items/R18393011/NOTTINGHAM'
);
await page.waitForTimeout(4000);
const html = await page.content();
writeFileSync('scripts/event-page-sample.html', html);
const lotCount = [...html.matchAll(/LotDetails\/(\d+)/g)].length;
console.log('unique lots', new Set([...html.matchAll(/LotDetails\/(\d+)/g)].map(m=>m[1])).size, 'total refs', lotCount);
const pag = html.match(/pagination|pageSize|PageIndex|LoadMore|ShowMore/gi);
console.log('pag keywords', pag?.slice(0,20));
await context.close();
