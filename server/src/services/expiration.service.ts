import { query } from '../config/database';
import { publishEvent } from '../config/kafka';
import { validateTransition } from '@gatepass/validation';
import { recordAudit } from './audit.service';

/**
 * Pass expiration scheduler.
 * Runs periodically to transition APPROVED passes that have exceeded
 * their validUntil time to EXPIRED status.
 */
export function startExpirationScheduler(): void {
  console.log('Pass expiration scheduler started (60s interval)');

  setInterval(async () => {
    try {
      await expireOverduePasses();
    } catch (error) {
      console.error('Expiration scheduler error:', error);
    }
  }, 60_000); // Every 60 seconds
}

async function expireOverduePasses(): Promise<void> {
  // Find APPROVED passes that have expired
  const expiredPasses = await query<any>(
    `UPDATE gate_passes
     SET status = 'EXPIRED', version = version + 1, updated_at = NOW()
     WHERE status = 'APPROVED' AND valid_until < NOW()
     RETURNING *`
  );

  for (const pass of expiredPasses) {
    await recordAudit({
      action: 'GATE_PASS_EXPIRED',
      entityType: 'gate_pass',
      entityId: pass.id,
      previousState: { status: 'APPROVED' },
      newState: { status: 'EXPIRED' },
    });

    publishEvent('gate-pass.expired', pass.id, {
      passId: pass.id,
      studentId: pass.student_id,
      expiredAt: new Date().toISOString(),
    });
  }

  if (expiredPasses.length > 0) {
    console.log(`Expired ${expiredPasses.length} overdue passes`);
  }
}
