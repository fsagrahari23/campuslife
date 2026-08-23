import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createGatePassSchema } from '@gatepass/validation';
import * as gatePassService from '../services/gatePass.service';
import { queryOne } from '../config/database';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/gate-passes — Create a new gate pass
router.post('/', authorize('student'), validate(createGatePassSchema), async (req: Request, res: Response) => {
  try {
    // Get student profile for this user
    const student = await queryOne<any>(
      'SELECT id FROM students WHERE user_id = $1',
      [req.user!.userId]
    );
    if (!student) {
      res.status(404).json({ error: 'Not Found', message: 'Student profile not found' });
      return;
    }

    const pass = await gatePassService.createGatePass(student.id, req.body);
    res.status(201).json(pass);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// GET /api/gate-passes — List student's passes
router.get('/', authorize('student'), async (req: Request, res: Response) => {
  try {
    const student = await queryOne<any>(
      'SELECT id FROM students WHERE user_id = $1',
      [req.user!.userId]
    );
    if (!student) {
      res.status(404).json({ error: 'Not Found', message: 'Student profile not found' });
      return;
    }

    const passes = await gatePassService.listStudentPasses(student.id);
    res.json({ data: passes });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// GET /api/gate-passes/:id — Get pass details
router.get('/:id', authorize('student', 'admin', 'guard'), async (req: Request, res: Response) => {
  try {
    const pass = await gatePassService.getGatePass(req.params.id);
    res.json(pass);
  } catch (error) {
    res.status(404).json({ error: 'Not Found', message: (error as Error).message });
  }
});

// GET /api/gate-passes/:id/qr — Get signed QR payload
router.get('/:id/qr', authorize('student'), async (req: Request, res: Response) => {
  try {
    const student = await queryOne<any>(
      'SELECT id FROM students WHERE user_id = $1',
      [req.user!.userId]
    );
    if (!student) {
      res.status(404).json({ error: 'Not Found', message: 'Student profile not found' });
      return;
    }

    const qrPayload = await gatePassService.getQRPayload(req.params.id, student.id);
    res.json({ qrPayload });
  } catch (error) {
    res.status(400).json({ error: 'Bad Request', message: (error as Error).message });
  }
});

export default router;
