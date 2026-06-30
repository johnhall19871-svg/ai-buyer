import { chromium } from 'playwright';
import { createSession, loadPage } from '../server/johnpyeBrowser.js';

const { browser, page } = await createSession();
try {
  await loadPage(page, 'https://www.johnpyeauctions.co.uk/');
  await loadPage(
    page,
    'https://www.johnpyeauctions.co.uk/Event/Details/530615923/Nottingham-SR9-350-Camping-Equipment-Power-Tools-Hair-And-Beauty-Items'
  );

  const data = await page.evaluate(() => {
    const prices = [...document.body.innerText.matchAll(/£([\d,]+\.\d{2})/g)].map((m) => m[0]).slice(0, 15);
    const times = [...document.body.innerText.matchAll(/\d+ Hours?, \d+ Minutes?/g)].map((m) => m[0]).slice(0, 15);
    const pagers = [...document.querySelectorAll('a')]
      .filter((a) => /page|next|prev|\b\d+\b/i.test(a.textContent) && a.getAttribute('href')?.includes('530615923'))
      .map((a) => ({ t: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 30), href: a.getAttribute('href') }))
      .slice(0, 20);
    return { prices, times, pagers };
  });
  console.log(data);

  // test RealTime endpoint via page.request (uses cookies)
  const rt = await page.request.post(
    'https://www.johnpyeauctions.co.uk/RealTime/GetNextLotClosing',
    { form: { eventId: '530615923' } }
  );
  console.log('GetNextLotClosing', rt.status(), (await rt.text()).slice(0, 500));
} finally {
  await browser.close();
}
