import { chromium } from 'playwright';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** @type {import('playwright').Browser | null} */
let browserInstance = null;

/**
 * @returns {Promise<{ browser: import('playwright').Browser, context: import('playwright').BrowserContext, page: import('playwright').Page }>}
 */
export async function createSession() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: process.env.JOHNPYE_HEADLESS !== '0',
      args: ['--disable-blink-features=AutomationControlled'],
    });
  }
  const context = await browserInstance.newContext({
    userAgent: USER_AGENT,
    locale: 'en-GB',
  });
  const page = await context.newPage();
  return { browser: browserInstance, context, page };
}

/**
 * @param {import('playwright').Page} page
 */
export async function waitForCloudflare(page) {
  for (let i = 0; i < 25; i++) {
    const html = await page.content();
    if (!html.includes('Just a moment') && !html.includes('cf-challenge')) return true;
    await page.waitForTimeout(1500);
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} url
 */
export async function loadPage(page, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      break;
    } catch (err) {
      const msg = String(err.message || err);
      if (!msg.includes('ERR_ABORTED') && !msg.includes('Timeout')) throw err;
      if (attempt === 2) throw err;
      await page.waitForTimeout(1500);
    }
  }
  const ok = await waitForCloudflare(page);
  if (!ok) throw new Error(`Cloudflare challenge did not clear: ${url}`);
  return page.url();
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
