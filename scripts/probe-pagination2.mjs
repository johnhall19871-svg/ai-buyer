import { createSession, loadPage } from '../server/johnpyeBrowser.js';

const { page, context } = await createSession();
await loadPage(page, 'https://www.johnpyeauctions.co.uk/');
await loadPage(
  page,
  'https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items'
);
await page.waitForTimeout(4000);

const pagers = await page.evaluate(() =>
  [...document.querySelectorAll('a, li')]
    .filter((el) => /page|next|prev|\b\d+\b/i.test(el.textContent) && el.closest('.pagination, nav, ul'))
    .map((el) => ({
      tag: el.tagName,
      text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30),
      href: el.getAttribute('href'),
      cls: el.className,
    }))
    .slice(0, 30)
);
console.log('pagers', pagers);

const pageLinks = await page.evaluate(() =>
  [...document.querySelectorAll('a[href*="530615923"]')]
    .map((a) => ({ text: a.textContent.trim().slice(0, 20), href: a.getAttribute('href') }))
    .filter((x) => /page|next|\d/.test(x.text + x.href))
    .slice(0, 20)
);
console.log('page links', pageLinks);

await context.close();
