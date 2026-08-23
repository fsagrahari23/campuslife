// Scan type
export type ScanType = 'OUTGOING' | 'INCOMING';

// Scan result
export type ScanResultType = 'VALID' | 'INVALID' | 'ERROR';

// Scan event stored locally
export interface ScanEvent {
  id: string;
  eventId: string;
  passId: string;
  deviceId: string;
  guardId: string;
  scanType: ScanType;
  result: ScanResultType;
  studentName?: string;
  rollNumber?: string;
  destination?: string;
  previousStatus?: string;
  newStatus?: string;
  errorMessage?: string;
  timestamp: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
  createdAt: string;
}

// Scan verification result (from QR processing)
export interface ScanVerificationResult {
  valid: boolean;
  passId?: string;
  studentName?: string;
  rollNumber?: string;
  destination?: string;
  purpose?: string;
  validFrom?: string;
  validUntil?: string;
  currentStatus?: string;
  newStatus?: string;
  errorMessage?: string;
}
