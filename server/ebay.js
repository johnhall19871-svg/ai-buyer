import { EBAY_LOOKBACK_DAYS, MAX_STOCK_DAYS } from './config.js';

/**
 * eBay sold comps — Phase 1 uses keyword heuristics + optional external API.
 * eBay blocks most server-side scraping; plug in SoldComps/Apify via EBAY_COMPS_API_URL.
 */

/** @type {Map<string, { fetchedAt: number, data: object }>} */
const cache = new Map();
const CACHE_MS = 60 * 60 * 1000;

/** UK resale comps by keyword pattern (illustrative — calibrate from real sold data) */
const COMP_TABLE = [
  { pattern: /playstation\s*5|ps5\s*console/i, median: 385, sold90: 842, avgDaysToSell: 12 },
  { pattern: /xbox\s*series\s*x/i, median: 320, sold90: 615, avgDaysToSell: 14 },
  { pattern: /lego\s*star\s*wars/i, median: 48, sold90: 1200, avgDaysToSell: 18 },
  { pattern: /lego/i, median: 28, sold90: 4500, avgDaysToSell: 22 },
  { pattern: /air fryer|ninja/i, median: 65, sold90: 890, avgDaysToSell: 15 },
  { pattern: /coffee machine|sage barista|nespresso/i, median: 120, sold90: 540, avgDaysToSell: 20 },
  { pattern: /dyson/i, median: 185, sold90: 720, avgDaysToSell: 16 },
  { pattern: /apple watch/i, median: 210, sold90: 980, avgDaysToSell: 14 },
  { pattern: /iphone\s*1[3-5]/i, median: 340, sold90: 2100, avgDaysToSell: 11 },
  { pattern: /designer|gucci|prada|burberry/i, median: 95, sold90: 380, avgDaysToSell: 28 },
  { pattern: /electric bike|e-bike/i, median: 450, sold90: 290, avgDaysToSell: 35 },
  { pattern: /microwave/i, median: 45, sold90: 620, avgDaysToSell: 25 },
  { pattern: /washing machine/i, median: 180, sold90: 410, avgDaysToSell: 32 },
  { pattern: /headphones|airpods|sony wh/i, median: 75, sold90: 1100, avgDaysToSell: 17 },
  { pattern: /perfume|fragrance|aftershave/i, median: 35, sold90: 780, avgDaysToSell: 19 },
  { pattern: /tool|dewalt|makita/i, median: 55, sold90: 950, avgDaysToSell: 21 },
  { pattern: /pokemon/i, median: 32, sold90: 680, avgDaysToSell: 16 },
  { pattern: /golf/i, median: 42, sold90: 520, avgDaysToSell: 24 },
];

function fallbackComp(title) {
  return { median: 35, sold90: 45, avgDaysToSell: 40, low: 20, high: 55, source: 'fallback' };
}

/**
 * @param {string} title
 */
function lookupTable(title) {
  for (const row of COMP_TABLE) {
    if (row.pattern.test(title)) {
      return {
        median: row.median,
        sold90: row.sold90,
        avgDaysToSell: row.avgDaysToSell,
        low: money(row.median * 0.75),
        high: money(row.median * 1.25),
        source: 'keyword_table',
      };
    }
  }
  return fallbackComp(title);
}

function money(v) {
  return Number(v.toFixed(2));
}

/**
 * Sell-through score 0–1 from sold count and estimated days to sell.
 * @param {number} sold90
 * @param {number} avgDaysToSell
 */
export function sellThroughScore(sold90, avgDaysToSell) {
  const volumeScore = Math.min(1, sold90 / 300);
  const speedScore = avgDaysToSell <= MAX_STOCK_DAYS ? 1 - avgDaysToSell / MAX_STOCK_DAYS : 0;
  return volumeScore * 0.55 + speedScore * 0.45;
}

/**
 * @param {string} keyword
 */
export async function getEbayComps(keyword) {
  const key = keyword.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return cached.data;
  }

  // Phase 2: call external sold-listings API when EBAY_COMPS_API_URL is set
  const data = {
    keyword,
    lookbackDays: EBAY_LOOKBACK_DAYS,
    ...lookupTable(keyword),
    sellThroughScore: sellThroughScore(
      lookupTable(keyword).sold90,
      lookupTable(keyword).avgDaysToSell
    ),
    dataSource:
      'Keyword comp table (Phase 1). Connect eBay sold API or paste real comps in Phase 2.',
  };
  data.sellThroughScore = sellThroughScore(data.sold90, data.avgDaysToSell);

  cache.set(key, { fetchedAt: Date.now(), data });
  return data;
}

export function clearCompCache() {
  cache.clear();
}
