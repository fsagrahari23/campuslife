import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as Network from 'expo-network';
import { useDatabase } from './DatabaseContext';
import { useAuth } from './AuthContext';
import { decodeQRPayload, verifyPass, isPassValid } from '@gatepass/crypto';
import { isValidTransition } from '@gatepass/validation';
import { ScanVerificationResult, GatePassStatus } from '@gatepass/shared-types';

import { DEFAULT_PUBLIC_KEY } from '../constants/publicKey';

const API_URL = 'http://localhost:3000/api';

// Initialized with build-time public key for instant offline verification
let PUBLIC_KEY = DEFAULT_PUBLIC_KEY;

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface SyncContextType {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  recentScans: any[];
  pendingEvents: any[];
  syncNow: () => Promise<void>;
  processScan: (qrData: string, scanType: 'OUTGOING' | 'INCOMING') => Promise<ScanVerificationResult>;
}

const SyncContext = createContext<SyncContextType>({
  isOnline: false, lastSyncTime: null, pendingCount: 0,
  recentScans: [], pendingEvents: [],
  syncNow: async () => {},
  processScan: async () => ({ valid: false }),
});

export function useSync() { return useContext(SyncContext); }

export function SyncProvider({ children }: { children: ReactNode }) {
  const { db, isReady } = useDatabase();
  const { getToken, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);

  // Network monitoring
  useEffect(() => {
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      } catch { setIsOnline(false); }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isReady && db) { loadData(); }
  }, [isReady, db]);

  useEffect(() => {
    if (isOnline && isReady && db) { syncNow(); }
  }, [isOnline, isReady]);

  const loadData = async () => {
    if (!db) return;
    try {
      const scans = await db.getAllAsync<any>(
        'SELECT * FROM local_scan_events ORDER BY timestamp DESC LIMIT 50'
      );
      setRecentScans(scans);

      const pending = await db.getAllAsync<any>(
        "SELECT * FROM outbox_events WHERE sync_status = 'PENDING' ORDER BY created_at ASC"
      );
      setPendingEvents(pending);
      setPendingCount(pending.length);
    } catch (error) { console.error('Load data error:', error); }
  };

  /**
   * Process a QR scan — the core offline verification flow.
   * 
   * 1. Decode QR payload
   * 2. Verify Ed25519 signature (OFFLINE)
   * 3. Check validity period
   * 4. Check revocation list (local)
   * 5. Check local pass state
   * 6. Apply state transition
   * 7. Store scan event in SQLite
   * 8. Add to outbox for sync
   */
  const processScan = async (qrData: string, scanType: 'OUTGOING' | 'INCOMING'): Promise<ScanVerificationResult> => {
    if (!db) return { valid: false, errorMessage: 'Database not ready' };

    const eventId = generateUUID();
    const scanId = generateUUID();
    const now = new Date().toISOString();
    const deviceId = 'guard-device-' + (profile?.id || 'unknown');

    try {
      // 1. Decode QR payload
      const signedPayload = decodeQRPayload(qrData);
      if (!signedPayload) {
        return saveScanResult(db, scanId, eventId, '', deviceId, scanType, 'INVALID', null, 'Invalid QR code format', now);
      }

      // 2. Verify Ed25519 signature (completely offline)
      if (PUBLIC_KEY) {
        const verification = await verifyPass(signedPayload, PUBLIC_KEY);
        if (!verification.valid) {
          return saveScanResult(db, scanId, eventId, signedPayload.passId, deviceId, scanType, 'INVALID', signedPayload, verification.error || 'Signature verification failed', now);
        }
      }

      // 3. Check validity period
      if (!isPassValid(signedPayload)) {
        return saveScanResult(db, scanId, eventId, signedPayload.passId, deviceId, scanType, 'INVALID', signedPayload, 'Pass has expired or is not yet valid', now);
      }

      // 4. Check local revocation list
      const revocation = await db.getFirstAsync<any>(
        'SELECT * FROM revocations WHERE pass_id = ?',
        [signedPayload.passId]
      );
      if (revocation) {
        return saveScanResult(db, scanId, eventId, signedPayload.passId, deviceId, scanType, 'INVALID', signedPayload, 'Pass has been revoked: ' + (revocation.reason || 'No reason'), now);
      }

      // 5. Check local pass state
      let localPass = await db.getFirstAsync<any>(
        'SELECT * FROM local_gate_passes WHERE id = ?',
        [signedPayload.passId]
      );

      // If not in local cache, create it with APPROVED status (from signature verification)
      if (!localPass) {
        await db.runAsync(
          `INSERT INTO local_gate_passes (id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, version, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)`,
          [
            signedPayload.passId,
            signedPayload.studentId || '',
            signedPayload.rollNumber || '',
            signedPayload.studentName || '',
            signedPayload.destination || '',
            signedPayload.purpose || '',
            signedPayload.validFrom || now,
            signedPayload.validUntil || now,
            JSON.stringify(signedPayload),
            signedPayload.version || 1,
            now,
          ]
        );
        localPass = { status: 'APPROVED' };
      }

      const currentStatus = localPass.status as GatePassStatus;
      const targetStatus: GatePassStatus = scanType === 'OUTGOING' ? 'OUT' : 'IN';

      // 6. Validate state transition
      if (!isValidTransition(currentStatus, targetStatus)) {
        let errorMsg = '';
        if (scanType === 'OUTGOING' && currentStatus !== 'APPROVED') {
          errorMsg = `Cannot mark OUT. Current status: ${currentStatus}. Pass must be APPROVED.`;
        } else if (scanType === 'INCOMING' && currentStatus !== 'OUT') {
          errorMsg = `Student is not currently marked OUT. Current status: ${currentStatus}.`;
        } else {
          errorMsg = `Invalid transition: ${currentStatus} → ${targetStatus}`;
        }
        return saveScanResult(db, scanId, eventId, signedPayload.passId, deviceId, scanType, 'INVALID', signedPayload, errorMsg, now);
      }

      // 7. Apply state transition locally
      await db.runAsync(
        'UPDATE local_gate_passes SET status = ?, updated_at = ? WHERE id = ?',
        [targetStatus, now, signedPayload.passId]
      );

      // 8. Save scan event
      const result = await saveScanResult(
        db, scanId, eventId, signedPayload.passId, deviceId, scanType, 'VALID', signedPayload, undefined, now,
        currentStatus, targetStatus
      );

      // 9. Add to outbox
      const eventType = scanType === 'OUTGOING' ? 'GATE_OUT' : 'GATE_IN';
      await db.runAsync(
        `INSERT INTO outbox_events (id, event_id, event_type, aggregate_id, payload, sync_status, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
        [generateUUID(), eventId, eventType, signedPayload.passId,
         JSON.stringify({ guardId: profile?.id, passId: signedPayload.passId, deviceId, timestamp: now }),
         now]
      );

      await loadData();
      return result;

    } catch (error) {
      console.error('Scan processing error:', error);
      return { valid: false, errorMessage: error instanceof Error ? error.message : 'Scan processing failed' };
    }
  };

  /**
   * Sync Manager — push and pull.
   */
  const syncNow = useCallback(async () => {
    if (!db || !isOnline) return;

    try {
      const token = await getToken();
      if (!token) return;

      // Fetch public key if we don't have it
      if (!PUBLIC_KEY) {
        try {
          const keyResponse = await fetch(`${API_URL}/public-key`);
          if (keyResponse.ok) {
            const keyData = await keyResponse.json();
            PUBLIC_KEY = keyData.publicKey;
          }
        } catch { /* will retry next sync */ }
      }

      // Push pending events
      const pending = await db.getAllAsync<any>(
        "SELECT * FROM outbox_events WHERE sync_status = 'PENDING' ORDER BY created_at ASC LIMIT 50"
      );

      if (pending.length > 0) {
        const deviceId = 'guard-device-' + (profile?.id || 'unknown');
        const events = pending.map((e: any) => ({
          eventId: e.event_id, eventType: e.event_type,
          aggregateId: e.aggregate_id, payload: JSON.parse(e.payload), timestamp: e.created_at,
        }));

        try {
          const res = await fetch(`${API_URL}/sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ deviceId, events }),
          });

          if (res.ok) {
            const result = await res.json();
            for (const eventId of result.successful) {
              await db.runAsync("UPDATE outbox_events SET sync_status = 'SYNCED' WHERE event_id = ?", [eventId]);
              await db.runAsync("UPDATE local_scan_events SET sync_status = 'SYNCED' WHERE event_id = ?", [eventId]);
            }
          }
        } catch (error) { console.log('Push sync failed:', error); }
      }

      // Pull changes
      try {
        const lastVersion = await db.getFirstAsync<any>("SELECT value FROM sync_metadata WHERE key = 'lastSyncVersion'");
        const lastSyncVersion = parseInt(lastVersion?.value || '0', 10);

        const res = await fetch(`${API_URL}/sync/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ deviceId: 'guard-device-' + (profile?.id || 'unknown'), lastSyncVersion }),
        });

        if (res.ok) {
          const result = await res.json();

          for (const change of result.changes) {
            if (change.entityType === 'gate_pass') {
              const d = change.data as any;
              await db.runAsync(
                `INSERT OR REPLACE INTO local_gate_passes (id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, version, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [d.id, d.studentId, d.rollNumber, d.studentName, d.destination, d.purpose, d.validFrom, d.validUntil, d.status, d.signature, d.version, new Date().toISOString()]
              );
            } else if (change.entityType === 'revocation') {
              const d = change.data as any;
              await db.runAsync(
                `INSERT OR REPLACE INTO revocations (id, pass_id, reason, revoked_at, version) VALUES (?, ?, ?, ?, ?)`,
                [d.id, d.passId, d.reason, d.revokedAt, d.version]
              );
            }
          }

          await db.runAsync(
            "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('lastSyncVersion', ?, ?)",
            [result.newVersion.toString(), new Date().toISOString()]
          );

          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch (error) { console.log('Pull sync failed:', error); }

      await loadData();
    } catch (error) { console.error('Sync error:', error); }
  }, [db, isOnline, getToken, profile]);

  return (
    <SyncContext.Provider value={{ isOnline, lastSyncTime, pendingCount, recentScans, pendingEvents, syncNow, processScan }}>
      {children}
    </SyncContext.Provider>
  );
}

// Helper to save scan result to SQLite and return verification result
async function saveScanResult(
  db: any, scanId: string, eventId: string, passId: string, deviceId: string,
  scanType: string, result: string, payload: any, errorMessage: string | undefined, timestamp: string,
  previousStatus?: string, newStatus?: string,
): Promise<ScanVerificationResult> {
  try {
    await db.runAsync(
      `INSERT INTO local_scan_events (id, event_id, pass_id, device_id, guard_id, scan_type, result, student_name, roll_number, destination, previous_status, new_status, error_message, timestamp, sync_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [scanId, eventId, passId, deviceId, '', scanType, result,
       payload?.studentName || null, payload?.rollNumber || null, payload?.destination || null,
       previousStatus || null, newStatus || null, errorMessage || null, timestamp, timestamp]
    );
  } catch (err) { console.error('Save scan result error:', err); }

  return {
    valid: result === 'VALID',
    passId: payload?.passId,
    studentName: payload?.studentName,
    rollNumber: payload?.rollNumber,
    destination: payload?.destination,
    validFrom: payload?.validFrom,
    validUntil: payload?.validUntil,
    currentStatus: previousStatus,
    newStatus,
    errorMessage,
  };
}
