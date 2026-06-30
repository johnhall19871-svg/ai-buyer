import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  HOME,
  COLLECTION_SITES,
  ALLOWED_LOCATIONS,
  TOP_N,
  AUCTION_ENDING_WITHIN_HOURS,
} from './config.js';
import { milesBetween } from './geo.js';
import { getEbayComps, sellThroughScore } from './ebay.js';
import { estimateWeightKg, shippingCost, shippingTierLabel } from './weight.js';
import { evaluateDeal, maxHammerBid } from './profit.js';
import {
  projectFinalBid,
  endsWithinHours,
  formatTimeRemaining,
  hoursUntilEnd,
} from './bidProjection.js';
import { recordPredictions, getCalibrationFactor } from './feedback.js';

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
 * Assign endsAt for demo lots: ~18 end within 24h, rest later (filtered out).
 * @param {Array<object>} listings
 */
function enrichEndsAt(listings) {
  const now = Date.now();
  return listings.map((item, i) => {
    const hours = i < 18 ? 1.5 + (i % 18) * 1.15 : 36 + (i % 10) * 6;
    const endsAt = item.endsAt || new Date(now + hours * 3600000).toISOString();
    // Sample data: early auction bids are lower than typical closing price
    const currentBid =
      i < 18 && !item.endsAt
        ? Number((item.currentBid * 0.42).toFixed(2))
        : item.currentBid;
    return { ...item, endsAt, currentBid };
  });
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function fetchListings() {
  let listings = sampleListings;

  if (process.env.JOHNPYE_LISTINGS_JSON) {
    try {
      const raw = readFileSync(process.env.JOHNPYE_LISTINGS_JSON, 'utf8');
      listings = JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }

  return enrichEndsAt(listings);
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
  if (!listing.endsAt || !endsWithinHours(listing.endsAt, AUCTION_ENDING_WITHIN_HOURS)) {
    return null;
  }

  const site = resolveSite(listing);
  if (!site || !ALLOWED_LOCATIONS.has(site.id)) return null;

  const milesOneWay = milesBetween(HOME, site);
  const weightKg = listing.weightKg ?? estimateWeightKg(listing.title);
  const ship = shippingCost(weightKg);
  const comps = await getEbayComps(listing.title);
  const projectedSale = listing.projectedSaleOverride ?? comps.median;
  const currentBid = Number(listing.currentBid ?? 0);

  const bidProjection = projectFinalBid(currentBid, listing.endsAt);
  const projectedFinalBid = bidProjection.projectedFinalBid;

  const maxBid = maxHammerBid(projectedSale, ship, milesOneWay);
  const atCurrent = evaluateDeal({
    hammer: currentBid,
    projectedSalePrice: projectedSale,
    outboundShipping: ship,
    milesOneWay,
  });
  const atProjected = evaluateDeal({
    hammer: projectedFinalBid,
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

  if (maxBid <= 0 || projectedFinalBid > maxBid) return null;

  const st = sellThroughScore(comps.sold90, comps.avgDaysToSell);
  const hoursLeft = hoursUntilEnd(listing.endsAt);
  const rankScore =
    (atProjected.netProfit ?? 0) * 0.35 +
    st * 100 * 0.3 +
    (atMax.netProfitPct ?? 0) * 0.2 +
    (maxBid - projectedFinalBid) * 0.15;

  return {
    id: listing.id,
    lotNumber: listing.lotNumber,
    title: listing.title,
    location: site.label,
    locationId: site.id,
    collectionPostcode: site.postcode,
    currentBid,
    projectedFinalBid,
    bidProjection,
    timeRemainingLabel: formatTimeRemaining(hoursLeft),
    hoursRemaining: bidProjection.hoursRemaining,
    maxBid,
    projectedSalePrice: projectedSale,
    weightKg,
    shippingTier: shippingTierLabel(weightKg),
    outboundShipping: ship,
    travelMilesOneWay: Number(milesOneWay.toFixed(1)),
    travelFuelRoundTrip: atProjected.buy.fuelCollection,
    ebaySold90Days: comps.sold90,
    avgDaysToSell: comps.avgDaysToSell,
    sellThroughScore: Number(st.toFixed(2)),
    ebayCompSource: comps.dataSource,
    profitAtCurrentBid: atCurrent,
    profitAtProjectedFinalBid: atProjected,
    profitAtMaxBid: atMax,
    url: listing.url,
    endsAt: listing.endsAt,
    rankScore: Number(rankScore.toFixed(2)),
  };
}

export async function getTopRecommendations(limit = TOP_N) {
  const allListings = await fetchListings();
  const endingSoon = allListings.filter((l) =>
    l.endsAt && endsWithinHours(l.endsAt, AUCTION_ENDING_WITHIN_HOURS)
  );

  const scored = (
    await Promise.all(endingSoon.map((l) => scoreListing(l)))
  ).filter(Boolean);

  scored.sort((a, b) => b.rankScore - a.rankScore);
  const recommendations = scored.slice(0, limit);

  recordPredictions(recommendations);

  const calibration = getCalibrationFactor();

  return {
    home: HOME,
    collectionSites: Object.values(COLLECTION_SITES),
    recommendations,
    totalCandidates: allListings.length,
    endingWithin24h: endingSoon.length,
    qualifiedCount: scored.length,
    endingWithinHours: AUCTION_ENDING_WITHIN_HOURS,
    bidCalibration: calibration,
    dataSource: {
      johnPye:
        'Phase 1 sample listings from 4 collection sites. Only lots ending within 24 hours are shown. Live feed requires Phase 2.',
      ebay: 'Keyword-based sold comps table. Connect sold-listings API in Phase 2.',
      bidProjection: `Surge model + calibration from ${calibration.sampleCount} resolved auction(s).`,
    },
    generatedAt: new Date().toISOString(),
  };
}
