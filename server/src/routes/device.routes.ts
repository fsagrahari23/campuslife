import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';

const router = Router();

router.use(authenticate);

// POST /api/devices/register — Register a device
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { deviceId, deviceType } = req.body;

    // Upsert device
    const existing = await queryOne(
      'SELECT id FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (existing) {
      await query(
        'UPDATE devices SET user_id = $1, last_seen_at = NOW() WHERE device_id = $2',
        [req.user!.userId, deviceId]
      );
    } else {
      await query(
        'INSERT INTO devices (id, device_id, user_id, device_type, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [uuidv4(), deviceId, req.user!.userId, deviceType]
      );
    }

    res.json({ success: true, deviceId });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

export default router;
