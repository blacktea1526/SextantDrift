import { Router } from 'express';
const router = Router();

// Missing currency, missing 409
router.post('/api/v1/orders', (req: any, res: any) => {
  const { amount } = req.body;
  if (!amount) {
    return res.status(400).json({ error: 'Missing amount' });
  }
  return res.status(201).json({ id: '1' });
});

// Undeclared shadow endpoint
router.delete('/api/v1/orders/debug_reset', (_req: any, res: any) => {
  return res.sendStatus(204);
});

// Note: GET /api/v1/orders/:id is missing completely

export default router;
