import { EventType } from './events';

// Push sync request (device → server)
export interface PushSyncRequest {
  deviceId: string;
  events: PushEvent[];
}

export interface PushEvent {
  eventId: string;
  eventType: EventType;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// Push sync response
export interface PushSyncResponse {
  successful: string[];  // event IDs
  failed: FailedEvent[];
  conflicts: ConflictEvent[];
}

export interface FailedEvent {
  eventId: string;
  error: string;
}

export interface ConflictEvent {
  eventId: string;
  serverState: Record<string, unknown>;
  resolution: string;
}

// Pull sync request (device ← server)
export interface PullSyncRequest {
  deviceId: string;
  lastSyncVersion: number;
  entityTypes?: string[];
}

// Pull sync response
export interface PullSyncResponse {
  changes: SyncChange[];
  newVersion: number;
  hasMore: boolean;
}

export interface SyncChange {
  entityType: 'gate_pass' | 'revocation' | 'gate_event';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  version: number;
  timestamp: string;
}

// Sync metadata
export interface SyncMetadata {
  key: string;
  value: string;
  updatedAt: string;
}
