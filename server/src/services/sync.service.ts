import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, withTransaction } from '../config/database';
import { PushSyncRequest, PushSyncResponse, PullSyncResponse } from '@gatepass/shared-types';
import { publishEvent } from '../config/kafka';
import * as gatePassService from './gatePass.service';

/**
 * Process push sync from a mobile device.
 * Each event is processed idempotently within a transaction.
 */
export async function pushSync(data: PushSyncRequest): Promise<PushSyncResponse> {
  const successful: string[] = [];
  const failed: { eventId: string; error: string }[] = [];
  const conflicts: { eventId: string; serverState: Record<string, unknown>; resolution: string }[] = [];

  for (const event of data.events) {
    try {
      // Check if already processed (idempotency)
      const existing = await queryOne(
        'SELECT id FROM sync_events WHERE event_id = $1',
        [event.eventId]
      );

      if (existing) {
        // Already processed — count as successful
        successful.push(event.eventId);
        continue;
      }

      // Process based on event type
      switch (event.eventType) {
        case 'GATE_PASS_CREATED': {
          const payload = event.payload as any;
          await gatePassService.createGatePass(payload.studentId, {
            rollNumber: payload.rollNumber,
            studentName: payload.studentName,
            destination: payload.destination,
            purpose: payload.purpose,
            validFrom: payload.validFrom,
            validUntil: payload.validUntil,
          });

          // Record sync event
          await query(
            `INSERT INTO sync_events (id, event_id, event_type, aggregate_id, device_id, payload)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [uuidv4(), event.eventId, event.eventType, event.aggregateId, data.deviceId, JSON.stringify(event.payload)]
          );
          successful.push(event.eventId);
          break;
        }

        case 'GATE_OUT': {
          const payload = event.payload as any;
          await gatePassService.processGateOut(
            event.aggregateId,
            payload.guardId,
            data.deviceId,
            event.eventId,
            event.timestamp
          );
          successful.push(event.eventId);
          break;
        }

        case 'GATE_IN': {
          const payload = event.payload as any;
          await gatePassService.processGateIn(
            event.aggregateId,
            payload.guardId,
            data.deviceId,
            event.eventId,
            event.timestamp
          );
          successful.push(event.eventId);
          break;
        }

        default:
          failed.push({ eventId: event.eventId, error: `Unknown event type: ${event.eventType}` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('Invalid state transition')) {
        // This is a conflict — the server state has diverged
        try {
          const pass = await gatePassService.getGatePass(event.aggregateId);
          conflicts.push({
            eventId: event.eventId,
            serverState: { status: pass.status, version: pass.version },
            resolution: `Server state is ${pass.status}, requested transition rejected`,
          });
        } catch {
          conflicts.push({
            eventId: event.eventId,
            serverState: {},
            resolution: message,
          });
        }
      } else {
        failed.push({ eventId: event.eventId, error: message });
      }
    }
  }

  // Update device last sync
  await query(
    `UPDATE devices SET last_seen_at = NOW() WHERE device_id = $1`,
    [data.deviceId]
  );

  publishEvent('device.synced', data.deviceId, {
    deviceId: data.deviceId,
    successful: successful.length,
    failed: failed.length,
    conflicts: conflicts.length,
    timestamp: new Date().toISOString(),
  });

  return { successful, failed, conflicts };
}

/**
 * Pull sync — return changes since a given version.
 * Uses a version-based cursor for incremental sync.
 */
export async function pullSync(
  deviceId: string,
  lastSyncVersion: number,
  entityTypes?: string[]
): Promise<PullSyncResponse> {
  const changes: any[] = [];
  const limit = 100;

  // Get gate pass changes
  if (!entityTypes || entityTypes.includes('gate_pass')) {
    const passes = await query(
      `SELECT *, version as change_version FROM gate_passes WHERE version > $1 ORDER BY version ASC LIMIT $2`,
      [lastSyncVersion, limit]
    );

    for (const pass of passes) {
      changes.push({
        entityType: 'gate_pass',
        entityId: pass.id,
        action: 'update',
        data: {
          id: pass.id,
          studentId: pass.student_id,
          rollNumber: pass.roll_number,
          studentName: pass.student_name,
          destination: pass.destination,
          purpose: pass.purpose,
          validFrom: pass.valid_from,
          validUntil: pass.valid_until,
          status: pass.status,
          signature: pass.signature,
          version: pass.version,
        },
        version: pass.version,
        timestamp: pass.updated_at,
      });
    }
  }

  // Get revocation changes
  if (!entityTypes || entityTypes.includes('revocation')) {
    const revocations = await query(
      `SELECT * FROM revocations WHERE version > $1 ORDER BY version ASC LIMIT $2`,
      [lastSyncVersion, limit]
    );

    for (const rev of revocations) {
      changes.push({
        entityType: 'revocation',
        entityId: rev.id,
        action: 'create',
        data: {
          id: rev.id,
          passId: rev.pass_id,
          reason: rev.reason,
          revokedAt: rev.revoked_at,
          version: rev.version,
        },
        version: rev.version,
        timestamp: rev.revoked_at,
      });
    }
  }

  // Sort by version and determine new version cursor
  changes.sort((a, b) => a.version - b.version);

  const newVersion = changes.length > 0
    ? changes[changes.length - 1].version
    : lastSyncVersion;

  // Update device last sync
  await query(
    `UPDATE devices SET last_sync_version = $1, last_seen_at = NOW() WHERE device_id = $2`,
    [newVersion, deviceId]
  );

  return {
    changes,
    newVersion,
    hasMore: changes.length === limit,
  };
}
