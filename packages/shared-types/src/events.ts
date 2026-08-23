// Event types for sync
export type EventType =
  | 'GATE_PASS_CREATED'
  | 'GATE_PASS_APPROVED'
  | 'GATE_PASS_REJECTED'
  | 'GATE_PASS_CANCELLED'
  | 'GATE_PASS_EXPIRED'
  | 'GATE_OUT'
  | 'GATE_IN'
  | 'DEVICE_SYNCED';

// Outbox event stored in SQLite
export interface OutboxEvent {
  id: string;
  eventId: string;
  eventType: EventType;
  aggregateId: string;
  payload: Record<string, unknown>;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastRetryAt?: string;
  createdAt: string;
}

// Sync event (server-side idempotency record)
export interface SyncEvent {
  id: string;
  eventId: string;
  eventType: EventType;
  aggregateId: string;
  deviceId: string;
  payload: Record<string, unknown>;
  processedAt: string;
  result?: Record<string, unknown>;
}
