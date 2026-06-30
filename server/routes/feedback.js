import { Router } from 'express';
import { recordActualFinalBid, getFeedbackSummary } from '../feedback.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getFeedbackSummary());
});

router.post('/actual', (req, res) => {
  const { listingId, actualFinalBid } = req.body ?? {};
  if (!listingId || actualFinalBid == null || Number.isNaN(Number(actualFinalBid))) {
    return res.status(400).json({ error: 'listingId and actualFinalBid are required' });
  }

  const result = recordActualFinalBid(String(listingId), Number(actualFinalBid));
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

export default router;
