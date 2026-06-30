import { money } from './geo.js';
import { getCalibrationFactor } from './feedback.js';

/**
 * Last-24h bidding surge multipliers (before calibration).
 * @param {number} hoursRemaining
 */
function baseSurgeMultiplier(hoursRemaining) {
  if (hoursRemaining <= 1) return 1.42;
  if (hoursRemaining <= 3) return 1.34;
  if (hoursRemaining <= 6) return 1.28;
  if (hoursRemaining <= 12) return 1.2;
  if (hoursRemaining <= 24) return 1.14;
  return 1.08;
}

/**
 * @param {string | Date} endsAt
 */
export function hoursUntilEnd(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  return ms / 3600000;
}

/**
 * @param {string | Date} endsAt
 * @param {number} [maxHours=24]
 */
export function endsWithinHours(endsAt, maxHours = 24) {
  const h = hoursUntilEnd(endsAt);
  return h > 0 && h <= maxHours;
}

/**
 * Project hammer price at auction close from current bid + time remaining.
 * Uses historical actual/projected ratio from feedback when available.
 * @param {number} currentBid
 * @param {string | Date} endsAt
 */
export function projectFinalBid(currentBid, endsAt) {
  const hoursRemaining = Math.max(0.1, hoursUntilEnd(endsAt));
  const { factor: calibration } = getCalibrationFactor();
  const surge = baseSurgeMultiplier(hoursRemaining);
  const projected = currentBid * surge * calibration;
  return {
    projectedFinalBid: money(Math.max(currentBid, projected)),
    hoursRemaining: money(hoursRemaining, 1),
    surgeMultiplier: money(surge, 2),
    calibrationFactor: calibration,
  };
}

/**
 * @param {number} hours
 */
export function formatTimeRemaining(hours) {
  if (hours < 1) return `${Math.round(hours * 60)}m left`;
  if (hours < 24) return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m left`;
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h left`;
}
