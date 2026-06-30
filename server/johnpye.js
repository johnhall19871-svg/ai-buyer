import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  HOME,
  COLLECTION_SITES,
  ALLOWED_LOCATIONS,
  TOP_N,
  AUCTION_ENDING_WITHIN_HOURS,
  FUEL_PER_MILE,
} from './config.js';
import { milesBetween, fuelCostRoundTrip } from './geo.js';
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
import { fetchLiveListings } from './johnpyeLive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const USE_LIVE = process.env.JOHNPYE_LIVE !== '0';

/** @type {Array<object>} */
let sampleListings = [];

try {
  const raw = readFileSync(path.join(__dirname, '..', 'data', 'sample-listings.json'), 'utf8');
  sampleListings = JSON.parse(raw);
} catch {
  sampleListings = [];
}

/** @type {{ source: string, detail?: string, fetchedAt?: string } | null} */
let lastFetchMeta = null;

/**
 * Assign endsAt for demo lots: ~18 end within 24h, rest later (filtered out).
 * @param {Array<object>} listings
 */
function enrichSampleListings(listings) {
  const now = Date.now();
  return listings.map((item, i) => {
    const hours = i < 18 ? 1.5 + (i % 18) * 1.15 : 36 + (i % 10) * 6;
    const endsAt = item.endsAt || new Date(now + hours * 3600000).toISOString();
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
  if (process.env.JOHNPYE_LISTINGS_JSON) {
    try {
      const raw = readFileSync(process.env.JOHNPYE_LISTINGS_JSON, 'utf8');
      lastFetchMeta = { source: 'json-file', detail: process.env.JOHNPYE_LISTINGS_JSON };
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[johnpye] JOHNPYE_LISTINGS_JSON read failed:', err.message);
    }
  }

  if (USE_LIVE) {
    try {
      const { listings, meta } = await fetchLiveListings();
      lastFetchMeta = {
        source: 'live',
        fetchedAt: meta.scannedAt,
        detail: `${meta.lotCount} lots, ${meta.durationMs}ms`,
      };
      return listings;
    } catch (err) {
      console.error('[johnpye] live fetch failed, falling back to sample:', err.message);
      lastFetchMeta = { source: 'sample-fallback', detail: err.message };
    }
  } else {
    lastFetchMeta = { source: 'sample', detail: 'JOHNPYE_LIVE=0' };
  }

  return enrichSampleListings(sampleListings);
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
 * @returns {Promise<object | null>}
 */
async function prepareListingContext(listing) {
  if (!listing.endsAt || !endsWithinHours(listing.endsAt, AUCTION_ENDING_WITHIN_HOURS)) {
    return null;
  }

  const site = resolveSite(listing);
  if (!site || !ALLOWED_LOCATIONS.has(site.id)) return null;

  const milesOneWay = milesBetween(HOME, site);
  const tripFuelRoundTrip = fuelCostRoundTrip(milesOneWay, FUEL_PER_MILE);
  const weightKg = listing.weightKg ?? estimateWeightKg(listing.title);
  const ship = shippingCost(weightKg);
  const comps = await getEbayComps(listing.title);
  const projectedSale = listing.projectedSaleOverride ?? comps.median;
  const currentBid = Number(listing.currentBid ?? 0);
  const bidProjection = projectFinalBid(currentBid, listing.endsAt);
  const projectedFinalBid = bidProjection.projectedFinalBid;
  const st = sellThroughScore(comps.sold90, comps.avgDaysToSell);
  const hoursLeft = hoursUntilEnd(listing.endsAt);

  return {
    listing,
    site,
    milesOneWay,
    tripFuelRoundTrip,
    ship,
    comps,
    projectedSale,
    currentBid,
    bidProjection,
    projectedFinalBid,
    st,
    hoursLeft,
  };
}

/**
 * @param {object} ctx
 * @param {number} fuelRoundTrip
 * @param {'primary' | 'additional'} fuelAllocation
 */
function evaluateListingContext(ctx, fuelRoundTrip, fuelAllocation) {
  const { listing, site, milesOneWay, ship, comps, projectedSale, currentBid, projectedFinalBid, st, hoursLeft, bidProjection, tripFuelRoundTrip } = ctx;

  const maxBid = maxHammerBid(projectedSale, ship, milesOneWay, fuelRoundTrip);
  const atCurrent = evaluateDeal({
    hammer: currentBid,
    projectedSalePrice: projectedSale,
    outboundShipping: ship,
    milesOneWay,
    fuelRoundTrip,
  });
  const atProjected = evaluateDeal({
    hammer: projectedFinalBid,
    projectedSalePrice: projectedSale,
    outboundShipping: ship,
    milesOneWay,
    fuelRoundTrip,
  });
  const atMax = evaluateDeal({
    hammer: maxBid,
    projectedSalePrice: projectedSale,
    outboundShipping: ship,
    milesOneWay,
    fuelRoundTrip,
  });

  const qualifies = maxBid > 0 && projectedFinalBid <= maxBid;
  const rankScore = qualifies
    ? (atProjected.netProfit ?? 0) * 0.35 +
      st * 100 * 0.3 +
      (atMax.netProfitPct ?? 0) * 0.2 +
      (maxBid - projectedFinalBid) * 0.15
    : 0;

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
    weightKg: listing.weightKg ?? estimateWeightKg(listing.title),
    shippingTier: shippingTierLabel(listing.weightKg ?? estimateWeightKg(listing.title)),
    outboundShipping: ship,
    travelMilesOneWay: Number(milesOneWay.toFixed(1)),
    tripFuelRoundTrip: Number(tripFuelRoundTrip.toFixed(2)),
    travelFuelRoundTrip: atProjected.buy.fuelCollection,
    fuelAllocation,
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
    qualifies,
  };
}

/**
 * Pick top items; only the first item per location pays collection fuel.
 * @param {Array<object>} contexts
 * @param {number} limit
 */
function selectRecommendations(contexts, limit) {
  const recs = [];
  const selectedIds = new Set();
  /** @type {Record<string, number>} */
  const locationCount = {};

  while (recs.length < limit) {
    let best = null;

    for (const ctx of contexts) {
      if (selectedIds.has(ctx.listing.id)) continue;

      const hasAnchor = (locationCount[ctx.site.id] || 0) > 0;
      const fuelRoundTrip = hasAnchor ? 0 : ctx.tripFuelRoundTrip;
      const fuelAllocation = hasAnchor ? 'additional' : 'primary';
      const scored = evaluateListingContext(ctx, fuelRoundTrip, fuelAllocation);
      if (!scored.qualifies) continue;

      if (!best || scored.rankScore > best.rankScore) best = scored;
    }

    if (!best) break;

    recs.push(best);
    selectedIds.add(best.id);
    locationCount[best.locationId] = (locationCount[best.locationId] || 0) + 1;
  }

  for (const rec of recs) {
    const n = locationCount[rec.locationId];
    rec.locationItemsInTrip = n;
    rec.tripFuelShare =
      n > 0 ? Number((rec.tripFuelRoundTrip / n).toFixed(2)) : rec.tripFuelRoundTrip;
  }

  return recs;
}

/**
 * Count items that qualify as a primary pickup or as a same-trip add-on.
 * @param {Array<object>} contexts
 */
function countQualified(contexts) {
  let count = 0;
  for (const ctx of contexts) {
    const asPrimary = evaluateListingContext(ctx, ctx.tripFuelRoundTrip, 'primary');
    const asAdditional = evaluateListingContext(ctx, 0, 'additional');
    if (asPrimary.qualifies || asAdditional.qualifies) count++;
  }
  return count;
}

/**
 * @param {object} listing
 * @deprecated use prepareListingContext + evaluateListingContext
 */
export async function scoreListing(listing) {
  const ctx = await prepareListingContext(listing);
  if (!ctx) return null;
  const scored = evaluateListingContext(ctx, ctx.tripFuelRoundTrip, 'primary');
  return scored.qualifies ? scored : null;
}

export async function getTopRecommendations(limit = TOP_N) {
  const allListings = await fetchListings();
  const endingSoon = allListings.filter(
    (l) => l.endsAt && endsWithinHours(l.endsAt, AUCTION_ENDING_WITHIN_HOURS)
  );

  const contexts = (
    await Promise.all(endingSoon.map((l) => prepareListingContext(l)))
  ).filter(Boolean);

  const qualifiedCount = countQualified(contexts);
  const recommendations = selectRecommendations(contexts, limit);

  recordPredictions(recommendations);

  const calibration = getCalibrationFactor();
  const johnPyeSource =
    lastFetchMeta?.source === 'live'
      ? `Live John Pye scrape (${lastFetchMeta.detail}). Only lots ending within ${AUCTION_ENDING_WITHIN_HOURS}h at 4 collection sites.`
      : lastFetchMeta?.source === 'json-file'
        ? `Listings from ${lastFetchMeta.detail}.`
        : lastFetchMeta?.source === 'sample-fallback'
          ? `Live scrape failed (${lastFetchMeta.detail}); using sample data.`
          : `Sample listings (set JOHNPYE_LIVE=1 or omit for live). Only lots ending within ${AUCTION_ENDING_WITHIN_HOURS}h.`;

  return {
    home: HOME,
    collectionSites: Object.values(COLLECTION_SITES),
    recommendations,
    totalCandidates: allListings.length,
    endingWithin24h: endingSoon.length,
    qualifiedCount,
    endingWithinHours: AUCTION_ENDING_WITHIN_HOURS,
    bidCalibration: calibration,
    dataSource: {
      johnPye: johnPyeSource,
      ebay: 'Keyword-based sold comps table. Connect sold-listings API in Phase 2.',
      bidProjection: `Surge model + calibration from ${calibration.sampleCount} resolved auction(s).`,
    },
    generatedAt: new Date().toISOString(),
  };
}
