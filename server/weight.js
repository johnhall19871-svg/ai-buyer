import { SHIPPING } from './config.js';

/**
 * Estimate item weight (kg) from listing title — Phase 1 heuristic.
 * Phase 2: lookup manufacturer specs or parse listing details.
 * @param {string} title
 */
export function estimateWeightKg(title) {
  const t = title.toLowerCase();

  if (/\b(american fridge|fridge freezer|double fridge|washing machine|tumble dryer|sofa|3 seater|corner sofa|wardrobe|dining table|desk|mattress|bbq|barbecue|engine|lathe|printer dtg)\b/.test(t)) {
    return 45;
  }
  if (/\b(microwave|coffee machine|air fryer|vacuum|drill|tool kit|lego|playstation|xbox|monitor|tv|television|bike|bicycle|pushchair|pram|table saw)\b/.test(t)) {
    return 12;
  }
  if (/\b(headphones|earbuds|watch|perfume|trainer|shoes|handbag|jewellery|ring|controller|game|camera|tablet|kindle|hair straightener|styler|makeup kit)\b/.test(t)) {
    return 1.5;
  }
  if (/\b(box|lot|bundle|pallet|mixed)\b/.test(t)) {
    return 18;
  }
  return 4;
}

/**
 * @param {number} weightKg
 */
export function shippingCost(weightKg) {
  if (weightKg < 5) return SHIPPING.under5kg;
  if (weightKg < 30) return SHIPPING.from5to30kg;
  return SHIPPING.over30kg;
}

/**
 * @param {number} weightKg
 */
export function shippingTierLabel(weightKg) {
  if (weightKg < 5) return 'Under 5kg';
  if (weightKg < 30) return '5–30kg';
  return '30kg+';
}
