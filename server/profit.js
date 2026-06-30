import {
  JOHN_PYE_BUYER_MULTIPLIER,
  EBAY_FEE_RATE,
  MIN_NET_PROFIT_RATE,
  FUEL_PER_MILE,
} from './config.js';
import { fuelCostRoundTrip, money, pct } from './geo.js';
import { shippingCost } from './weight.js';

/**
 * Total cost to buy at hammer price H including John Pye premium + collection fuel.
 * @param {number} hammer
 * @param {number} milesOneWay
 * @param {number} [fuelRoundTrip] allocated fuel for this item (0 for same-trip add-ons)
 */
export function totalBuyCost(hammer, milesOneWay, fuelRoundTrip) {
  const fuel =
    fuelRoundTrip ??
    fuelCostRoundTrip(milesOneWay, FUEL_PER_MILE);
  return {
    hammer,
    johnPyeInvoice: money(hammer * JOHN_PYE_BUYER_MULTIPLIER),
    buyerPremium: money(hammer * (JOHN_PYE_BUYER_MULTIPLIER - 1)),
    fuelCollection: money(fuel),
    total: money(hammer * JOHN_PYE_BUYER_MULTIPLIER + fuel),
  };
}

/**
 * Net revenue after eBay fees and outbound shipping (shipping paid by seller).
 * @param {number} salePrice
 * @param {number} outboundShipping
 */
export function netSaleRevenue(salePrice, outboundShipping) {
  const ebayFees = salePrice * EBAY_FEE_RATE;
  return {
    salePrice,
    ebayFees: money(ebayFees),
    outboundShipping: money(outboundShipping),
    net: money(salePrice - ebayFees - outboundShipping),
  };
}

/**
 * Max hammer bid to achieve minimum net profit rate.
 * @param {number} projectedSalePrice
 * @param {number} outboundShipping
 * @param {number} milesOneWay
 * @param {number} [fuelRoundTrip] allocated fuel for this item
 */
export function maxHammerBid(projectedSalePrice, outboundShipping, milesOneWay, fuelRoundTrip) {
  const sale = netSaleRevenue(projectedSalePrice, outboundShipping);
  const fuel =
    fuelRoundTrip ??
    fuelCostRoundTrip(milesOneWay, FUEL_PER_MILE);
  const netRevenue = sale.net ?? 0;

  // netRevenue - (H * multiplier + fuel) >= MIN * (H * multiplier + fuel)
  // netRevenue >= (1 + MIN) * (H * m + fuel)
  // H <= (netRevenue / (1+MIN) - fuel) / m
  const m = JOHN_PYE_BUYER_MULTIPLIER;
  const target = netRevenue / (1 + MIN_NET_PROFIT_RATE) - fuel;
  const maxHammer = target > 0 ? target / m : 0;
  return money(Math.max(0, maxHammer));
}

/**
 * Full profit picture at a given hammer bid.
 * @param {{ hammer: number, projectedSalePrice: number, outboundShipping: number, milesOneWay: number, fuelRoundTrip?: number }} params
 */
export function evaluateDeal({
  hammer,
  projectedSalePrice,
  outboundShipping,
  milesOneWay,
  fuelRoundTrip,
}) {
  const buy = totalBuyCost(hammer, milesOneWay, fuelRoundTrip);
  const sale = netSaleRevenue(projectedSalePrice, outboundShipping);
  const netProfit = (sale.net ?? 0) - (buy.total ?? 0);
  const netProfitRate = buy.total > 0 ? netProfit / buy.total : 0;

  return {
    buy,
    sale,
    netProfit: money(netProfit),
    netProfitPct: pct(netProfitRate),
    meetsTarget: netProfitRate >= MIN_NET_PROFIT_RATE,
    maxHammerBid: maxHammerBid(
      projectedSalePrice,
      outboundShipping,
      milesOneWay,
      fuelRoundTrip
    ),
  };
}
