import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, withTransaction } from '../config/database';
import { publishEvent } from '../config/kafka';
import { GatePass, GatePassStatus, CreateGatePassRequest } from '@gatepass/shared-types';
import { validateTransition } from '@gatepass/validation';
import { signPass } from '@gatepass/crypto';
import { config } from '../config';
import { recordAudit } from './audit.service';

/**
 * Create a new gate pass for a student.
 * The pass starts in PENDING state — it does NOT auto-approve.
 */
export async function createGatePass(
  studentId: string,
  data: CreateGatePassRequest
): Promise<GatePass> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const result = await queryOne<any>(
    `INSERT INTO gate_passes (id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', 1, $9, $9)
     RETURNING *`,
    [id, studentId, data.rollNumber, data.studentName, data.destination, data.purpose, data.validFrom, data.validUntil, now]
  );

  const gatePass = formatGatePass(result);

  // Record audit
  await recordAudit({
    actorId: studentId,
    action: 'GATE_PASS_CREATED',
    entityType: 'gate_pass',
    entityId: id,
    newState: { status: 'PENDING', destination: data.destination },
  });

  // Publish Kafka event (non-blocking)
  publishEvent('gate-pass.created', id, {
    passId: id,
    studentId,
    rollNumber: data.rollNumber,
    destination: data.destination,
    timestamp: now,
  });

  return gatePass;
}

/**
 * Get a gate pass by ID.
 */
export async function getGatePass(passId: string): Promise<GatePass> {
  const result = await queryOne<any>(
    'SELECT * FROM gate_passes WHERE id = $1',
    [passId]
  );
  if (!result) throw new Error('Gate pass not found');
  return formatGatePass(result);
}

/**
 * List gate passes for a student.
 */
export async function listStudentPasses(studentId: string): Promise<GatePass[]> {
  const rows = await query<any>(
    'SELECT * FROM gate_passes WHERE student_id = $1 ORDER BY created_at DESC',
    [studentId]
  );
  return rows.map(formatGatePass);
}

/**
 * List all gate passes (admin).
 */
export async function listAllPasses(filters?: {
  status?: GatePassStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ data: GatePass[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;
  const offset = (page - 1) * pageSize;

  let whereClause = '';
  const params: any[] = [];

  if (filters?.status) {
    params.push(filters.status);
    whereClause = `WHERE status = $${params.length}`;
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM gate_passes ${whereClause}`,
    params
  );

  params.push(pageSize, offset);
  const rows = await query<any>(
    `SELECT * FROM gate_passes ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    data: rows.map(formatGatePass),
    total: parseInt(countResult?.count || '0', 10),
  };
}

/**
 * Approve a gate pass — generates Ed25519 signed QR payload.
 * Transition: PENDING → APPROVED
 */
export async function approveGatePass(passId: string, adminId: string): Promise<GatePass> {
  return withTransaction(async (client) => {
    // Lock the row for update
    const result = await client.query(
      'SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE',
      [passId]
    );
    if (result.rows.length === 0) throw new Error('Gate pass not found');

    const pass = result.rows[0];
    validateTransition(pass.status, 'APPROVED');

    // Sign the pass with Ed25519
    const signedPayload = await signPass(
      {
        passId: pass.id,
        studentId: pass.student_id,
        rollNumber: pass.roll_number,
        studentName: pass.student_name,
        destination: pass.destination,
        validFrom: pass.valid_from.toISOString(),
        validUntil: pass.valid_until.toISOString(),
        version: pass.version + 1,
      },
      config.ed25519.privateKey
    );

    // Update the pass
    const updated = await client.query(
      `UPDATE gate_passes SET status = 'APPROVED', signature = $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(signedPayload), passId]
    );

    // Record audit
    await recordAudit({
      actorId: adminId,
      action: 'GATE_PASS_APPROVED',
      entityType: 'gate_pass',
      entityId: passId,
      previousState: { status: pass.status },
      newState: { status: 'APPROVED' },
    });

    publishEvent('gate-pass.approved', passId, {
      passId,
      adminId,
      timestamp: new Date().toISOString(),
    });

    return formatGatePass(updated.rows[0]);
  });
}

/**
 * Reject a gate pass.
 * Transition: PENDING → REJECTED
 */
export async function rejectGatePass(passId: string, adminId: string, reason?: string): Promise<GatePass> {
  return withTransaction(async (client) => {
    const result = await client.query(
      'SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE',
      [passId]
    );
    if (result.rows.length === 0) throw new Error('Gate pass not found');

    const pass = result.rows[0];
    validateTransition(pass.status, 'REJECTED');

    const updated = await client.query(
      `UPDATE gate_passes SET status = 'REJECTED', version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [passId]
    );

    await recordAudit({
      actorId: adminId,
      action: 'GATE_PASS_REJECTED',
      entityType: 'gate_pass',
      entityId: passId,
      previousState: { status: pass.status },
      newState: { status: 'REJECTED', reason },
    });

    publishEvent('gate-pass.rejected', passId, { passId, adminId, reason, timestamp: new Date().toISOString() });

    return formatGatePass(updated.rows[0]);
  });
}

/**
 * Cancel a gate pass.
 * Transition: APPROVED → CANCELLED
 */
export async function cancelGatePass(passId: string, adminId: string, reason?: string): Promise<GatePass> {
  return withTransaction(async (client) => {
    const result = await client.query(
      'SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE',
      [passId]
    );
    if (result.rows.length === 0) throw new Error('Gate pass not found');

    const pass = result.rows[0];
    validateTransition(pass.status, 'CANCELLED');

    const updated = await client.query(
      `UPDATE gate_passes SET status = 'CANCELLED', version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [passId]
    );

    // Add to revocations table so guards can sync
    await client.query(
      `INSERT INTO revocations (id, pass_id, reason, revoked_by, revoked_at, version)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [uuidv4(), passId, reason, adminId, pass.version + 1]
    );

    await recordAudit({
      actorId: adminId,
      action: 'GATE_PASS_CANCELLED',
      entityType: 'gate_pass',
      entityId: passId,
      previousState: { status: pass.status },
      newState: { status: 'CANCELLED', reason },
    });

    publishEvent('gate-pass.cancelled', passId, { passId, adminId, reason, timestamp: new Date().toISOString() });

    return formatGatePass(updated.rows[0]);
  });
}

/**
 * Process a gate OUT event (guard scan).
 * Transition: APPROVED → OUT
 */
export async function processGateOut(
  passId: string,
  guardId: string,
  deviceId: string,
  eventId: string,
  timestamp: string
): Promise<GatePass> {
  return withTransaction(async (client) => {
    // Check idempotency
    const existing = await client.query(
      'SELECT id FROM sync_events WHERE event_id = $1',
      [eventId]
    );
    if (existing.rows.length > 0) {
      // Already processed — return current state
      const pass = await client.query('SELECT * FROM gate_passes WHERE id = $1', [passId]);
      return formatGatePass(pass.rows[0]);
    }

    // Lock the pass
    const result = await client.query(
      'SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE',
      [passId]
    );
    if (result.rows.length === 0) throw new Error('Gate pass not found');

    const pass = result.rows[0];
    validateTransition(pass.status, 'OUT');

    // Update pass status
    const updated = await client.query(
      `UPDATE gate_passes SET status = 'OUT', version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [passId]
    );

    // Insert gate event
    await client.query(
      `INSERT INTO gate_events (id, event_id, pass_id, device_id, guard_id, event_type, previous_status, new_status, result, timestamp)
       VALUES ($1, $2, $3, $4, $5, 'GATE_OUT', $6, 'OUT', 'SUCCESS', $7)`,
      [uuidv4(), eventId, passId, deviceId, guardId, pass.status, timestamp]
    );

    // Record sync event for idempotency
    await client.query(
      `INSERT INTO sync_events (id, event_id, event_type, aggregate_id, device_id, payload)
       VALUES ($1, $2, 'GATE_OUT', $3, $4, $5)`,
      [uuidv4(), eventId, passId, deviceId, JSON.stringify({ guardId, timestamp })]
    );

    await recordAudit({
      actorId: guardId,
      deviceId,
      action: 'GATE_OUT',
      entityType: 'gate_pass',
      entityId: passId,
      previousState: { status: pass.status },
      newState: { status: 'OUT' },
    });

    publishEvent('gate.out', passId, { passId, guardId, deviceId, timestamp });

    return formatGatePass(updated.rows[0]);
  });
}

/**
 * Process a gate IN event (guard scan).
 * Transition: OUT → IN
 */
export async function processGateIn(
  passId: string,
  guardId: string,
  deviceId: string,
  eventId: string,
  timestamp: string
): Promise<GatePass> {
  return withTransaction(async (client) => {
    // Check idempotency
    const existing = await client.query(
      'SELECT id FROM sync_events WHERE event_id = $1',
      [eventId]
    );
    if (existing.rows.length > 0) {
      const pass = await client.query('SELECT * FROM gate_passes WHERE id = $1', [passId]);
      return formatGatePass(pass.rows[0]);
    }

    const result = await client.query(
      'SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE',
      [passId]
    );
    if (result.rows.length === 0) throw new Error('Gate pass not found');

    const pass = result.rows[0];
    validateTransition(pass.status, 'IN');

    const updated = await client.query(
      `UPDATE gate_passes SET status = 'IN', version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [passId]
    );

    await client.query(
      `INSERT INTO gate_events (id, event_id, pass_id, device_id, guard_id, event_type, previous_status, new_status, result, timestamp)
       VALUES ($1, $2, $3, $4, $5, 'GATE_IN', $6, 'IN', 'SUCCESS', $7)`,
      [uuidv4(), eventId, passId, deviceId, guardId, pass.status, timestamp]
    );

    await client.query(
      `INSERT INTO sync_events (id, event_id, event_type, aggregate_id, device_id, payload)
       VALUES ($1, $2, 'GATE_IN', $3, $4, $5)`,
      [uuidv4(), eventId, passId, deviceId, JSON.stringify({ guardId, timestamp })]
    );

    await recordAudit({
      actorId: guardId,
      deviceId,
      action: 'GATE_IN',
      entityType: 'gate_pass',
      entityId: passId,
      previousState: { status: pass.status },
      newState: { status: 'IN' },
    });

    publishEvent('gate.in', passId, { passId, guardId, deviceId, timestamp });

    return formatGatePass(updated.rows[0]);
  });
}

/**
 * Get currently OUT students.
 */
export async function getCurrentlyOutStudents(): Promise<GatePass[]> {
  const rows = await query<any>(
    "SELECT * FROM gate_passes WHERE status = 'OUT' ORDER BY updated_at DESC"
  );
  return rows.map(formatGatePass);
}

/**
 * Get gate events history.
 */
export async function getGateEvents(limit = 100): Promise<any[]> {
  return query(
    `SELECT ge.*, gp.student_name, gp.roll_number, gp.destination
     FROM gate_events ge
     JOIN gate_passes gp ON ge.pass_id = gp.id
     ORDER BY ge.timestamp DESC
     LIMIT $1`,
    [limit]
  );
}

/**
 * Get signed QR payload for an approved pass.
 */
export async function getQRPayload(passId: string, studentId: string): Promise<string> {
  const pass = await queryOne<any>(
    'SELECT * FROM gate_passes WHERE id = $1 AND student_id = $2',
    [passId, studentId]
  );

  if (!pass) throw new Error('Gate pass not found');
  if (pass.status !== 'APPROVED' && pass.status !== 'OUT') {
    throw new Error('QR code is only available for approved or active passes');
  }
  if (!pass.signature) throw new Error('Pass has not been signed yet');

  return pass.signature;
}

// Format database row to GatePass type
function formatGatePass(row: any): GatePass {
  return {
    id: row.id,
    studentId: row.student_id,
    rollNumber: row.roll_number,
    studentName: row.student_name,
    destination: row.destination,
    purpose: row.purpose,
    validFrom: row.valid_from instanceof Date ? row.valid_from.toISOString() : row.valid_from,
    validUntil: row.valid_until instanceof Date ? row.valid_until.toISOString() : row.valid_until,
    status: row.status,
    signature: row.signature,
    version: row.version,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}
