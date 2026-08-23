import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';

interface AuditEntry {
  actorId?: string;
  deviceId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Record an audit log entry.
 * Every important operation must be auditable.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (id, actor_id, device_id, action, entity_type, entity_id, previous_state, new_state, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        uuidv4(),
        entry.actorId || null,
        entry.deviceId || null,
        entry.action,
        entry.entityType,
        entry.entityId || null,
        entry.previousState ? JSON.stringify(entry.previousState) : null,
        entry.newState ? JSON.stringify(entry.newState) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('Audit log error:', error);
  }
}

/**
 * Get audit logs with optional filters.
 */
export async function getAuditLogs(filters?: {
  action?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}): Promise<any[]> {
  const limit = filters?.limit || 100;
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.action) {
    params.push(filters.action);
    conditions.push(`action = $${params.length}`);
  }
  if (filters?.entityType) {
    params.push(filters.entityType);
    conditions.push(`entity_type = $${params.length}`);
  }
  if (filters?.entityId) {
    params.push(filters.entityId);
    conditions.push(`entity_id = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  return query(
    `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT $${params.length}`,
    params
  );
}
