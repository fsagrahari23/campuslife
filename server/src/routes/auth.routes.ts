import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { loginSchema, refreshTokenSchema } from '@gatepass/validation';
import * as authService from '../services/auth.service';

const router = Router();

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized', message: (error as Error).message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized', message: (error as Error).message });
  }
});

export default router;
