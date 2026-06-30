import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { money } from './geo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FEEDBACK_PATH = path.join(DATA_DIR, 'bid-feedback.json');

/** @typedef {{ id: string, listingId: string, lotNumber: string, title: string, currentBidAtPrediction: number, projectedFinalBid: number, predictedAt: string, endsAt: string, actualFinalBid: number | null, resolvedAt: string | null, errorPct: number | null }} Prediction */

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FEEDBACK_PATH)) {
    writeFileSync(FEEDBACK_PATH, JSON.stringify({ predictions: [] }, null, 2));
  }
}

/**
 * @returns {{ predictions: Prediction[] }}
 */
function loadStore() {
  ensureStore();
  return JSON.parse(readFileSync(FEEDBACK_PATH, 'utf8'));
}

/** @param {{ predictions: Prediction[] }} store */
function saveStore(store) {
  ensureStore();
  writeFileSync(FEEDBACK_PATH, JSON.stringify(store, null, 2));
}

/**
 * Median calibration ratio: actual / projected for resolved predictions.
 */
export function getCalibrationFactor() {
  const store = loadStore();
  const ratios = store.predictions
    .filter((p) => p.actualFinalBid != null && p.projectedFinalBid > 0)
    .map((p) => p.actualFinalBid / p.projectedFinalBid);

  if (ratios.length === 0) return { factor: 1, sampleCount: 0, meanAbsErrorPct: null };

  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median =
    ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;

  const errors = store.predictions
    .filter((p) => p.actualFinalBid != null && p.projectedFinalBid > 0)
    .map((p) => Math.abs(p.actualFinalBid - p.projectedFinalBid) / p.projectedFinalBid);

  const meanAbsErrorPct =
    errors.reduce((s, e) => s + e, 0) / errors.length;

  return {
    factor: money(Math.min(1.5, Math.max(0.75, median)), 3),
    sampleCount: ratios.length,
    meanAbsErrorPct: money(meanAbsErrorPct * 100, 1),
  };
}

/**
 * Log predictions for today's recommendations (dedupe by listingId + endsAt window).
 * @param {Array<object>} recommendations
 */
export function recordPredictions(recommendations) {
  const store = loadStore();
  const now = Date.now();

  for (const rec of recommendations) {
    const existing = store.predictions.find(
      (p) =>
        p.listingId === rec.id &&
        p.endsAt === rec.endsAt &&
        p.actualFinalBid == null &&
        now - new Date(p.predictedAt).getTime() < 6 * 3600000
    );
    if (existing) continue;

    store.predictions.push({
      id: randomUUID(),
      listingId: rec.id,
      lotNumber: rec.lotNumber,
      title: rec.title,
      currentBidAtPrediction: rec.currentBid,
      projectedFinalBid: rec.projectedFinalBid,
      predictedAt: new Date().toISOString(),
      endsAt: rec.endsAt,
      actualFinalBid: null,
      resolvedAt: null,
      errorPct: null,
    });
  }

  saveStore(store);
}

/**
 * @param {string} listingId
 * @param {number} actualFinalBid
 */
export function recordActualFinalBid(listingId, actualFinalBid) {
  const store = loadStore();
  const pending = store.predictions
    .filter((p) => p.listingId === listingId && p.actualFinalBid == null)
    .sort((a, b) => new Date(b.predictedAt) - new Date(a.predictedAt));

  const target = pending[0];
  if (!target) {
    return { ok: false, error: 'No pending prediction found for this listing' };
  }

  target.actualFinalBid = money(actualFinalBid);
  target.resolvedAt = new Date().toISOString();
  target.errorPct = money(
    ((actualFinalBid - target.projectedFinalBid) / target.projectedFinalBid) * 100,
    1
  );

  saveStore(store);
  return { ok: true, prediction: target, calibration: getCalibrationFactor() };
}

export function getFeedbackSummary() {
  const store = loadStore();
  const calibration = getCalibrationFactor();
  const pending = store.predictions.filter(
    (p) => p.actualFinalBid == null && new Date(p.endsAt).getTime() <= Date.now()
  );
  const resolved = store.predictions.filter((p) => p.actualFinalBid != null);

  return {
    calibration,
    pendingResolution: pending.slice(0, 50),
    recentResolved: resolved.slice(-20).reverse(),
    totalPredictions: store.predictions.length,
  };
}
