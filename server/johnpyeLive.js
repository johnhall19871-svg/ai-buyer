import { createSession, loadPage } from './johnpyeBrowser.js';

const BASE = 'https://www.johnpyeauctions.co.uk';
const JS_WAIT_MS = Number(process.env.JOHNPYE_JS_WAIT_MS || 3500);

/** @type {Record<string, { re: RegExp, filterText: string }>} */
export const LOCATION_RULES = {
  nottingham: { re: /nottingham/i, filterText: 'NOTTINGHAM' },
  chesterfield: { re: /chesterfield/i, filterText: 'CHESTERFIELD' },
  birmingham: { re: /birmingham/i, filterText: 'BIRMINGHAM' },
  staffordshire: { re: /marchington|staffordshire/i, filterText: 'MARCHINGTON' },
};

/** @type {{ listings: Array<object>, fetchedAt: number, meta: object } | null} */
let cache = null;
const CACHE_MS = Number(process.env.JOHNPYE_CACHE_MS || 15 * 60 * 1000);

/**
 * @param {string} remaining e.g. "11 Hours, 38 Minutes"
 */
export function parseRemainingTime(remaining) {
  if (!remaining) return null;
  const s = remaining.trim();
  let hours = 0;
  const dayM = s.match(/(\d+)\s*Days?/i);
  const hrM = s.match(/(\d+)\s*Hours?/i);
  const minM = s.match(/(\d+)\s*Minutes?/i);
  if (dayM) hours += Number(dayM[1]) * 24;
  if (hrM) hours += Number(hrM[1]);
  if (minM) hours += Number(minM[1]) / 60;
  if (hours <= 0) return null;
  return new Date(Date.now() + hours * 3600000).toISOString();
}

/**
 * @param {import('playwright').Page} page
 */
async function discoverEvents(page) {
  await loadPage(page, `${BASE}/`);
  return page.evaluate((origin) => {
    const seen = new Set();
    const events = [];
    for (const a of document.querySelectorAll('a[href*="/Event/Details/"]')) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/Event\/Details\/(\d+)(?:\/([^/?#]+))?/);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      const slug = m[2] || '';
      const label = (slug.replace(/-/g, ' ') + ' ' + a.textContent).replace(/\s+/g, ' ').trim();
      events.push({
        eventId: m[1],
        href: href.startsWith('http') ? href.split('?')[0] : `${origin}${href.split('?')[0]}`,
        label: label.slice(0, 200),
      });
    }
    return events;
  }, BASE);
}

/**
 * @param {string} label
 * @param {string} href
 */
function eventLocationIds(label, href) {
  const text = `${label} ${href}`;
  return Object.entries(LOCATION_RULES)
    .filter(([, rule]) => rule.re.test(text))
    .map(([id]) => id);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} eventUrl
 * @param {string} filterText e.g. NOTTINGHAM
 */
async function resolveCatalogUrl(page, eventUrl, filterText) {
  await loadPage(page, eventUrl);
  const filterHref = await page.evaluate((wanted) => {
    for (const a of document.querySelectorAll('a[href*="/Event/Details/"]')) {
      const text = a.textContent.replace(/\s+/g, ' ').trim();
      const href = a.getAttribute('href') || '';
      if (text.toUpperCase() === wanted && href.includes(`/R`) && href.includes(`/${wanted}`)) {
        return href.split('?')[0];
      }
    }
    return null;
  }, filterText);

  if (filterHref) {
    return filterHref.startsWith('http') ? filterHref : `${BASE}${filterHref}`;
  }
  return eventUrl;
}

/**
 * @param {import('playwright').Page} page
 */
async function parseCatalogPage(page, locationId) {
  await page.waitForTimeout(JS_WAIT_MS);
  const rule = LOCATION_RULES[locationId];

  return page.evaluate(
    ({ locId, locReSource }) => {
      const locRe = new RegExp(locReSource, 'i');
      const lots = [];
      const panels = document.querySelectorAll('.panel.panel-default');

      for (const card of panels) {
        const link = card.querySelector('a[href*="/Event/LotDetails/"]');
        if (!link) continue;
        const href = link.getAttribute('href') || '';
        const lotId = href.match(/LotDetails\/(\d+)/)?.[1];
        if (!lotId) continue;

        const cardText = card.innerText.replace(/\s+/g, ' ').trim();
        if (!locRe.test(cardText)) continue;

        const lotNumber = cardText.match(/Lot\s+#?\s*(\d+)/i)?.[1] || lotId;
        const priceRaw = card.querySelector('.awe-rt-CurrentPrice')?.textContent || '';
        const currentBid = Number(priceRaw.replace(/[£,\s]/g, '')) || 0;
        const remaining =
          card.querySelector('.galleryTime--active')?.textContent?.replace(/\s+/g, ' ').trim() || '';

        const titleMatch = cardText.match(
          /Lot\s+\d+\s+.+?\s+(?:Delivery Only|Collection Only|Optional Home Delivery[^]*?)\s+(.+?)\s+CURRENT BID/i
        );
        let title = titleMatch?.[1]?.trim();
        if (!title) {
          title = cardText
            .replace(/^Lot\s+\d+\s+/i, '')
            .replace(/\s+CURRENT BID.*$/i, '')
            .trim();
        }

        lots.push({
          id: `jp-${lotId}`,
          lotNumber,
          title,
          location: locId,
          currentBid,
          remaining,
          url: href.startsWith('http') ? href.split('?')[0] : `${location.origin}${href.split('?')[0]}`,
        });
      }
      return lots;
    },
    { locId: locationId, locReSource: rule.re.source }
  );
}

/**
 * @param {import('playwright').Page} page
 * @param {string} catalogUrl
 * @param {string} locationId
 * @param {number} maxPages
 */
async function scrapeCatalog(page, catalogUrl, locationId, maxPages) {
  /** @type {Map<string, object>} */
  const byId = new Map();

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const url =
      pageIndex === 0
        ? catalogUrl
        : `${catalogUrl}${catalogUrl.includes('?') ? '&' : '?'}page=${pageIndex}`;
    await loadPage(page, url);
    const lots = await parseCatalogPage(page, locationId);
    if (!lots.length) break;

    for (const lot of lots) {
      lot.endsAt = parseRemainingTime(lot.remaining);
      delete lot.remaining;
      byId.set(lot.id, lot);
    }

    const hasNext = await page.evaluate(() => {
      const active = document.querySelector('.pagination li.active');
      const next = active?.nextElementSibling?.querySelector('a[href*="page="]');
      return Boolean(next);
    });
    if (!hasNext) break;
  }

  return [...byId.values()];
}

/**
 * @returns {Promise<{ listings: Array<object>, meta: object }>}
 */
export async function fetchLiveListings() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) {
    return { listings: cache.listings, meta: cache.meta };
  }

  const maxEventsPerLocation = Number(process.env.JOHNPYE_MAX_EVENTS_PER_LOCATION || 2);
  const maxPages = Number(process.env.JOHNPYE_MAX_PAGES || 2);

  const { page, context } = await createSession();
  const started = Date.now();
  /** @type {Map<string, object>} */
  const allLots = new Map();
  const scanLog = [];

  try {
    const events = await discoverEvents(page);

    for (const [locationId, rule] of Object.entries(LOCATION_RULES)) {
      const locationEvents = events
        .filter((ev) => eventLocationIds(ev.label, ev.href).includes(locationId))
        .slice(0, maxEventsPerLocation);

      scanLog.push({ locationId, events: locationEvents.length });

      for (const ev of locationEvents) {
        try {
          const catalogUrl = await resolveCatalogUrl(page, ev.href, rule.filterText);
          const lots = await scrapeCatalog(page, catalogUrl, locationId, maxPages);
          scanLog.push({ locationId, eventId: ev.eventId, lots: lots.length, catalogUrl });
          for (const lot of lots) allLots.set(lot.id, lot);
        } catch (err) {
          console.warn(`[johnpye-live] skip event ${ev.eventId} (${locationId}):`, err.message);
          scanLog.push({ locationId, eventId: ev.eventId, error: err.message });
        }
      }
    }
  } finally {
    await context.close();
  }

  const listings = [...allLots.values()];
  const meta = {
    source: 'live',
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    lotCount: listings.length,
    scanLog,
  };

  cache = { listings, fetchedAt: Date.now(), meta };
  console.log(`[johnpye-live] ${listings.length} lots in ${meta.durationMs}ms`);
  return { listings, meta };
}

export function clearLiveCache() {
  cache = null;
}
