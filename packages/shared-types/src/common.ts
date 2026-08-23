// Audit log entry
export interface AuditLog {
  id: string;
  actorId?: string;
  deviceId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// Revocation record
export interface Revocation {
  id: string;
  passId: string;
  reason?: string;
  revokedBy?: string;
  revokedAt: string;
  version: number;
}

// System statistics
export interface SystemStats {
  totalStudents: number;
  totalGuards: number;
  totalPasses: number;
  pendingPasses: number;
  approvedPasses: number;
  currentlyOut: number;
  todayEvents: number;
  pendingSyncEvents: number;
}

// API error response
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
