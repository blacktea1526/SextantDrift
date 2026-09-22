import { Router } from 'express';
const router = Router();

router.post('/api/v1/orders', (req: any, res: any) => {
  const { amount, currency } = req.body;
  if (!amount || !currency) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (amount < 0) {
    return res.status(409).json({ error: 'Conflict' });
  }
  return res.status(201).json({ id: '1' });
});

router.get('/api/v1/orders/:id', (req: any, res: any) => {
  const { id } = req.params;
  if (!id) {
    return res.sendStatus(404);
  }
  return res.status(200).json({ id });
});

export default router;
