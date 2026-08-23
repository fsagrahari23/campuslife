// Gate Pass Status enum
export type GatePassStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'OUT'
  | 'IN'
  | 'EXPIRED';

// Gate Pass entity
export interface GatePass {
  id: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  destination: string;
  purpose: string;
  validFrom: string; // ISO 8601
  validUntil: string; // ISO 8601
  status: GatePassStatus;
  signature?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Create gate pass request (student-facing)
export interface CreateGatePassRequest {
  rollNumber: string;
  studentName: string;
  destination: string;
  purpose: string;
  validFrom: string;
  validUntil: string;
}

// Gate pass response from server
export interface GatePassResponse extends GatePass {
  syncStatus?: SyncStatus;
}

// Sync status for local tracking
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
