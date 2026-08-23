/**
 * Gate Pass State Machine
 *
 * Defines all valid state transitions for gate passes.
 * This is the SINGLE SOURCE OF TRUTH for the state machine,
 * used by both the backend (enforcement) and frontend (UI hints).
 *
 * State diagram:
 *   PENDING → APPROVED | REJECTED
 *   APPROVED → OUT | CANCELLED | EXPIRED
 *   OUT → IN
 */

import { GatePassStatus } from '@gatepass/shared-types';

// Valid transitions map: fromState → Set of valid toStates
const VALID_TRANSITIONS: Record<GatePassStatus, Set<GatePassStatus>> = {
  PENDING: new Set(['APPROVED', 'REJECTED']),
  APPROVED: new Set(['OUT', 'CANCELLED', 'EXPIRED']),
  REJECTED: new Set([]),
  CANCELLED: new Set([]),
  OUT: new Set(['IN']),
  IN: new Set([]),
  EXPIRED: new Set([]),
};

/**
 * Check if a state transition is valid.
 *
 * @param from - Current status
 * @param to - Desired new status
 * @returns true if the transition is allowed
 */
export function isValidTransition(from: GatePassStatus, to: GatePassStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS[from];
  if (!allowedTransitions) return false;
  return allowedTransitions.has(to);
}

/**
 * Get all valid next states for a given status.
 */
export function getValidNextStates(from: GatePassStatus): GatePassStatus[] {
  return Array.from(VALID_TRANSITIONS[from] || []);
}

/**
 * Validate a state transition, throwing an error if invalid.
 *
 * @param from - Current status
 * @param to - Desired new status
 * @throws Error if the transition is not allowed
 */
export function validateTransition(from: GatePassStatus, to: GatePassStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid state transition: ${from} → ${to}. ` +
        `Valid transitions from ${from}: ${getValidNextStates(from).join(', ') || 'none'}`
    );
  }
}

/**
 * Check if a status is a terminal state (no further transitions possible).
 */
export function isTerminalState(status: GatePassStatus): boolean {
  return getValidNextStates(status).length === 0;
}

/**
 * All possible gate pass statuses.
 */
export const ALL_STATUSES: GatePassStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'OUT',
  'IN',
  'EXPIRED',
];
