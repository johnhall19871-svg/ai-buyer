import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'en-GB',
});
const page = await context.newPage();
const apiCalls = [];
page.on('response', async (r) => {
  const u = r.url();
  if (
    u.includes('johnpyeauctions') &&
    (u.includes('api') || u.includes('Lot') || u.includes('Search') || u.includes('Browse'))
  ) {
    apiCalls.push({
      status: r.status(),
      url: u,
      ct: (r.headers()['content-type'] || '').slice(0, 40),
    });
  }
});

async function load(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 15; i++) {
    if (!(await page.content()).includes('Just a moment')) break;
    await page.waitForTimeout(2000);
  }
}

await load('https://www.johnpyeauctions.co.uk/');
const links = await page.$$eval('a[href*="Event/Details"]', (as) =>
  as.slice(0, 15).map((a) => ({
    href: a.getAttribute('href'),
    text: a.textContent.trim().slice(0, 80),
  }))
);
console.log('event links:', links);

for (const loc of ['Nottingham', 'Chesterfield', 'Birmingham', 'Marchington']) {
  const ev = links.find((l) => new RegExp(loc, 'i').test(l.href + l.text));
  if (!ev) {
    console.log('no event for', loc);
    continue;
  }
  const detailUrl = ev.href.startsWith('http')
    ? ev.href
    : `https://www.johnpyeauctions.co.uk${ev.href}`;
  await load(detailUrl);
  const lotNav = await page.$$eval('a', (as) =>
    as
      .filter((a) => /Lot|Lots|View All/i.test(a.textContent))
      .map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 80) }))
  );
  const html = await page.content();
  const eventId = detailUrl.match(/Details\/(\d+)/)?.[1];
  console.log('\n===', loc, 'event', eventId, '===');
  console.log('lot nav:', lotNav.slice(0, 5));
  console.log('LotDetails ids:', [...new Set([...html.matchAll(/LotDetails\/(\d+)/g)].map((m) => m[1]))].slice(0, 3));

  const lotsHref = lotNav.find((l) => /Lots|View All/i.test(l.text))?.href;
  if (lotsHref) {
    const lotsUrl = lotsHref.startsWith('http')
      ? lotsHref
      : `https://www.johnpyeauctions.co.uk${lotsHref}`;
    await load(lotsUrl);
    const lotsHtml = await page.content();
    console.log('lots page url:', page.url());
    console.log('lots page title:', await page.title());
    console.log(
      'LotDetails count:',
      [...new Set([...lotsHtml.matchAll(/LotDetails\/(\d+)/g)].map((m) => m[1]))].length
    );
    const sample = [...lotsHtml.matchAll(/LotDetails\/(\d+)\/[^"']+/g)].slice(0, 2).map((m) => m[0]);
    console.log('sample paths:', sample);
  }
}

console.log('\napi calls:', apiCalls.filter((a) => a.status === 200).slice(0, 30));
await browser.close();
