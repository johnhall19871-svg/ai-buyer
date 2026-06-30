import { Router } from 'express';
import { getTopRecommendations } from '../johnpye.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await getTopRecommendations();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to build recommendations',
    });
  }
});

export default router;
