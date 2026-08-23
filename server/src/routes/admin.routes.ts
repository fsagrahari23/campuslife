import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as gatePassService from '../services/gatePass.service';
import { getAuditLogs } from '../services/audit.service';
import { query } from '../config/database';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

// GET /api/admin/gate-passes — List all passes
router.get('/gate-passes', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.pageSize as string || '50', 10);

    const result = await gatePassService.listAllPasses({ status: status as any, page, pageSize });
    res.json({
      ...result,
      page,
      pageSize,
      hasMore: page * pageSize < result.total,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// POST /api/admin/gate-passes/:id/approve
router.post('/gate-passes/:id/approve', async (req: Request, res: Response) => {
  try {
    const pass = await gatePassService.approveGatePass(req.params.id, req.user!.userId);
    res.json(pass);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes('not found') ? 404 : message.includes('Invalid state') ? 409 : 500;
    res.status(status).json({ error: 'Error', message });
  }
});

// POST /api/admin/gate-passes/:id/reject
router.post('/gate-passes/:id/reject', async (req: Request, res: Response) => {
  try {
    const pass = await gatePassService.rejectGatePass(req.params.id, req.user!.userId, req.body.reason);
    res.json(pass);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes('not found') ? 404 : message.includes('Invalid state') ? 409 : 500;
    res.status(status).json({ error: 'Error', message });
  }
});

// POST /api/admin/gate-passes/:id/cancel
router.post('/gate-passes/:id/cancel', async (req: Request, res: Response) => {
  try {
    const pass = await gatePassService.cancelGatePass(req.params.id, req.user!.userId, req.body.reason);
    res.json(pass);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes('not found') ? 404 : message.includes('Invalid state') ? 409 : 500;
    res.status(status).json({ error: 'Error', message });
  }
});

// GET /api/admin/students — List all students
router.get('/students', async (_req: Request, res: Response) => {
  try {
    const students = await query(
      `SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id ORDER BY s.name ASC`
    );
    res.json({ data: students });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// GET /api/admin/students/out — Currently OUT students
router.get('/students/out', async (_req: Request, res: Response) => {
  try {
    const outStudents = await gatePassService.getCurrentlyOutStudents();
    res.json({ data: outStudents });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// GET /api/admin/gate-events — IN/OUT history
router.get('/gate-events', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const events = await gatePassService.getGateEvents(limit);
    res.json({ data: events });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await getAuditLogs({
      action: req.query.action as string,
      entityType: req.query.entityType as string,
      limit: parseInt(req.query.limit as string || '100', 10),
    });
    res.json({ data: logs });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// GET /api/admin/devices — Guard devices
router.get('/devices', async (_req: Request, res: Response) => {
  try {
    const devices = await query(
      `SELECT d.*, u.email FROM devices d LEFT JOIN users u ON d.user_id = u.id ORDER BY d.last_seen_at DESC`
    );
    res.json({ data: devices });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

// GET /api/admin/stats — System statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [students, guards, passes, pending, approved, out, todayEvents, pendingSync] = await Promise.all([
      query("SELECT COUNT(*) as count FROM students"),
      query("SELECT COUNT(*) as count FROM guards"),
      query("SELECT COUNT(*) as count FROM gate_passes"),
      query("SELECT COUNT(*) as count FROM gate_passes WHERE status = 'PENDING'"),
      query("SELECT COUNT(*) as count FROM gate_passes WHERE status = 'APPROVED'"),
      query("SELECT COUNT(*) as count FROM gate_passes WHERE status = 'OUT'"),
      query("SELECT COUNT(*) as count FROM gate_events WHERE timestamp >= CURRENT_DATE"),
      query("SELECT COUNT(*) as count FROM sync_events WHERE processed_at >= CURRENT_DATE"),
    ]);

    res.json({
      totalStudents: parseInt(students[0]?.count || '0', 10),
      totalGuards: parseInt(guards[0]?.count || '0', 10),
      totalPasses: parseInt(passes[0]?.count || '0', 10),
      pendingPasses: parseInt(pending[0]?.count || '0', 10),
      approvedPasses: parseInt(approved[0]?.count || '0', 10),
      currentlyOut: parseInt(out[0]?.count || '0', 10),
      todayEvents: parseInt(todayEvents[0]?.count || '0', 10),
      pendingSyncEvents: parseInt(pendingSync[0]?.count || '0', 10),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', message: (error as Error).message });
  }
});

export default router;
