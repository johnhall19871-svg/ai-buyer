import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOME, COLLECTION_SITES, ALLOWED_LOCATIONS, TOP_N } from './config.js';
import { milesBetween } from './geo.js';
import { getEbayComps, sellThroughScore } from './ebay.js';
import { estimateWeightKg, shippingCost, shippingTierLabel } from './weight.js';
import { evaluateDeal, maxHammerBid } from './profit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Array<object>} */
let sampleListings = [];

try {
  const raw = readFileSync(path.join(__dirname, '..', 'data', 'sample-listings.json'), 'utf8');
  sampleListings = JSON.parse(raw);
} catch {
  sampleListings = [];
}

/**
 * Phase 2: live fetch from John Pye (requires browser session — Cloudflare blocks server fetch).
 * @returns {Promise<Array<object>>}
 */
export async function fetchListings() {
  if (process.env.JOHNPYE_LISTINGS_JSON) {
    try {
      const raw = readFileSync(process.env.JOHNPYE_LISTINGS_JSON, 'utf8');
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return sampleListings;
}

/**
 * @param {object} listing
 */
function resolveSite(listing) {
  const loc = String(listing.location || '').toLowerCase();
  if (COLLECTION_SITES[loc]) return COLLECTION_SITES[loc];
  return null;
}

/**
 * @param {object} listing
 */
export async function scoreListing(listing) {
  const site = resolveSite(listing);
  if (!site || !ALLOWED_LOCATIONS.has(site.id)) return null;

  const milesOneWay = milesBetween(HOME, site);
  const weightKg = listing.weightKg ?? estimateWeightKg(listing.title);
  const ship = shippingCost(weightKg);
  const comps = await getEbayComps(listing.title);
  const projectedSale = listing.projectedSaleOverride ?? comps.median;
  const currentBid = Number(listing.currentBid ?? 0);

  const maxBid = maxHammerBid(projectedSale, ship, milesOneWay);
  const atCurrent = evaluateDeal({
    hammer: currentBid,
    projectedSalePrice: projectedSale,
    outboundShipping: ship,
    milesOneWay,
  });
  const atMax = evaluateDeal({
    hammer: maxBid,
    projectedSalePrice: projectedSale,
    outboundShipping: ship,
    milesOneWay,
  });

  if (maxBid <= 0 || !atMax.meetsTarget) return null;

  const st = sellThroughScore(comps.sold90, comps.avgDaysToSell);
  const rankScore =
    (atCurrent.netProfit ?? 0) * 0.4 +
    st * 100 * 0.35 +
    (atMax.netProfitPct ?? 0) * 0.25;

  return {
    id: listing.id,
    lotNumber: listing.lotNumber,
    title: listing.title,
    location: site.label,
    locationId: site.id,
    collectionPostcode: site.postcode,
    currentBid,
    maxBid,
    projectedSalePrice: projectedSale,
    weightKg,
    shippingTier: shippingTierLabel(weightKg),
    outboundShipping: ship,
    travelMilesOneWay: Number(milesOneWay.toFixed(1)),
    travelFuelRoundTrip: atCurrent.buy.fuelCollection,
    ebaySold90Days: comps.sold90,
    avgDaysToSell: comps.avgDaysToSell,
    sellThroughScore: Number(st.toFixed(2)),
    ebayCompSource: comps.dataSource,
    profitAtCurrentBid: atCurrent,
    profitAtMaxBid: atMax,
    url: listing.url,
    endsAt: listing.endsAt ?? null,
    rankScore: Number(rankScore.toFixed(2)),
  };
}

export async function getTopRecommendations(limit = TOP_N) {
  const listings = await fetchListings();
  const scored = (
    await Promise.all(listings.map((l) => scoreListing(l)))
  ).filter(Boolean);

  scored.sort((a, b) => b.rankScore - a.rankScore);

  return {
    home: HOME,
    collectionSites: Object.values(COLLECTION_SITES),
    recommendations: scored.slice(0, limit),
    totalCandidates: listings.length,
    qualifiedCount: scored.length,
    dataSource: {
      johnPye:
        'Phase 1 sample listings from 4 collection sites. Live John Pye feed requires Phase 2 (account/browser integration — site uses Cloudflare).',
      ebay: 'Keyword-based sold comps table. Connect sold-listings API in Phase 2.',
    },
    generatedAt: new Date().toISOString(),
  };
}
