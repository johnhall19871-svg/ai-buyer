const EARTH_RADIUS_MILES = 3958.8;

/**
 * @param {{ latitude: number, longitude: number }} a
 * @param {{ latitude: number, longitude: number }} b
 */
export function milesBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(h));
}

/** Round-trip fuel cost */
export function fuelCostRoundTrip(milesOneWay, fuelPerMile) {
  return milesOneWay * 2 * fuelPerMile;
}

/** @param {number} value @param {number} [d=2] */
export function money(value, d = 2) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(d));
}

/** @param {number} value @param {number} [d=1] */
export function pct(value, d = 1) {
  return Number((value * 100).toFixed(d));
}
