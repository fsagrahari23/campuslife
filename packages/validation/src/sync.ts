import { z } from 'zod';

/**
 * Sync validation schemas.
 */

const pushEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum([
    'GATE_PASS_CREATED',
    'GATE_PASS_APPROVED',
    'GATE_PASS_REJECTED',
    'GATE_PASS_CANCELLED',
    'GATE_PASS_EXPIRED',
    'GATE_OUT',
    'GATE_IN',
    'DEVICE_SYNCED',
  ]),
  aggregateId: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

export const pushSyncSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  events: z.array(pushEventSchema).min(1, 'At least one event is required'),
});

export const pullSyncSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  lastSyncVersion: z.number().int().min(0),
  entityTypes: z.array(z.string()).optional(),
});

export type PushSyncInput = z.infer<typeof pushSyncSchema>;
export type PullSyncInput = z.infer<typeof pullSyncSchema>;
