import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pushSyncSchema, pullSyncSchema } from '@gatepass/validation';
import * as syncService from '../services/sync.service';

const router = Router();

router.use(authenticate);

// POST /api/sync/push — Push offline events to server
router.post('/push', validate(pushSyncSchema), async (req: Request, res: Response) => {
  try {
    const result = await syncService.pushSync(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Sync Error', message: (error as Error).message });
  }
});

// POST /api/sync/pull — Pull server changes
router.post('/pull', validate(pullSyncSchema), async (req: Request, res: Response) => {
  try {
    const result = await syncService.pullSync(
      req.body.deviceId,
      req.body.lastSyncVersion,
      req.body.entityTypes
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Sync Error', message: (error as Error).message });
  }
});

export default router;
