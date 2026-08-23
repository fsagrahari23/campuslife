import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as Network from 'expo-network';
import { useDatabase } from './DatabaseContext';
import { useAuth } from './AuthContext';
import { CreateGatePassRequest, QRPayload } from '@gatepass/shared-types';
import { signPass, encodeQRPayload } from '@gatepass/crypto';

const API_URL = 'http://localhost:3000/api';
const DEV_SIGNING_KEY = '857a0d97035bf81b3a8cfee97271980d63402b7e97063d139ff290bd33fb2fc0';

// Generate a simple UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface SyncContextType {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  passes: any[];
  activePass: any;
  syncNow: () => Promise<void>;
  createPassOffline: (data: CreateGatePassRequest) => Promise<any>;
}

const SyncContext = createContext<SyncContextType>({
  isOnline: false,
  lastSyncTime: null,
  pendingCount: 0,
  passes: [],
  activePass: null,
  syncNow: async () => {},
  createPassOffline: async () => ({}),
});

export function useSync() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { db, isReady } = useDatabase();
  const { getToken, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [passes, setPasses] = useState<any[]>([]);
  const [activePass, setActivePass] = useState<any>(null);

  // Monitor network state
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      } catch {
        setIsOnline(false);
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load passes from SQLite when database is ready
  useEffect(() => {
    if (isReady && db) {
      loadPasses();
      loadPendingCount();
    }
  }, [isReady, db]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && isReady && db) {
      syncNow();
    }
  }, [isOnline, isReady]);

  const loadPasses = async () => {
    if (!db) return;
    try {
      const rows = await db.getAllAsync<any>(
        'SELECT * FROM local_gate_passes ORDER BY created_at DESC'
      );
      setPasses(rows.map(formatLocalPass));

      // Find active pass (APPROVED or OUT, fallback to most recent PENDING)
      const active = rows.find((p: any) => p.status === 'APPROVED' || p.status === 'OUT')
        || rows.find((p: any) => p.status === 'PENDING');
      setActivePass(active ? formatLocalPass(active) : null);
    } catch (error) {
      console.error('Error loading passes:', error);
    }
  };

  const loadPendingCount = async () => {
    if (!db) return;
    try {
      const result = await db.getFirstAsync<any>(
        "SELECT COUNT(*) as count FROM outbox_events WHERE sync_status = 'PENDING'"
      );
      setPendingCount(result?.count || 0);
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  /**
   * Create a gate pass offline-first.
   * 1. Save to SQLite immediately
   * 2. Add to outbox
   * 3. If online, sync immediately
   */
  const createPassOffline = async (data: CreateGatePassRequest): Promise<any> => {
    if (!db) throw new Error('Database not ready');

    const id = generateUUID();
    const eventId = generateUUID();
    const now = new Date().toISOString();

    const qrPayload: QRPayload = {
      passId: id,
      studentId: profile?.id || 'student-1',
      rollNumber: data.rollNumber,
      studentName: data.studentName,
      destination: data.destination,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      version: 1,
    };

    let signatureStr = '';
    try {
      const signed = await signPass(qrPayload, DEV_SIGNING_KEY);
      signatureStr = encodeQRPayload(signed);
    } catch (e) {
      console.warn('Local signing fallback:', e);
      signatureStr = JSON.stringify(qrPayload);
    }

    // Save to local_gate_passes immediately with APPROVED status and signature
    await db.runAsync(
      `INSERT INTO local_gate_passes (id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, 'PENDING', ?, ?)`,
      [id, profile?.id || 'student-1', data.rollNumber, data.studentName, data.destination, data.purpose, data.validFrom, data.validUntil, signatureStr, now, now]
    );

    // Add to outbox
    await db.runAsync(
      `INSERT INTO outbox_events (id, event_id, event_type, aggregate_id, payload, sync_status, created_at)
       VALUES (?, ?, 'GATE_PASS_CREATED', ?, ?, 'PENDING', ?)`,
      [generateUUID(), eventId, id, JSON.stringify({ ...data, studentId: profile?.id, status: 'APPROVED', signature: signatureStr }), now]
    );

    await loadPasses();
    await loadPendingCount();

    // Try immediate sync if online
    if (isOnline) {
      try {
        const token = await getToken();
        if (token) {
          const response = await fetch(`${API_URL}/gate-passes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            const serverPass = await response.json();
            // Update local record with server ID
            await db.runAsync(
              `UPDATE local_gate_passes SET server_id = ?, sync_status = 'SYNCED', updated_at = ? WHERE id = ?`,
              [serverPass.id, new Date().toISOString(), id]
            );
            await db.runAsync(
              `UPDATE outbox_events SET sync_status = 'SYNCED' WHERE event_id = ?`,
              [eventId]
            );
            await loadPasses();
            await loadPendingCount();
          }
        }
      } catch (error) {
        console.log('Immediate sync failed, will retry later:', error);
      }
    }

    return {
      id,
      rollNumber: data.rollNumber,
      studentName: data.studentName,
      destination: data.destination,
      purpose: data.purpose,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      status: 'APPROVED',
      signature: signatureStr,
      syncStatus: isOnline ? 'SYNCED' : 'PENDING',
    };
  };

  /**
   * Sync Manager — push pending events and pull server changes.
   */
  const syncNow = useCallback(async () => {
    if (!db || !isOnline) return;

    try {
      const token = await getToken();
      if (!token) return;

      // 1. Push pending outbox events
      const pendingEvents = await db.getAllAsync<any>(
        "SELECT * FROM outbox_events WHERE sync_status = 'PENDING' ORDER BY created_at ASC LIMIT 50"
      );

      if (pendingEvents.length > 0) {
        const deviceId = 'student-device-' + (profile?.id || 'unknown');
        const events = pendingEvents.map((e: any) => ({
          eventId: e.event_id,
          eventType: e.event_type,
          aggregateId: e.aggregate_id,
          payload: JSON.parse(e.payload),
          timestamp: e.created_at,
        }));

        try {
          const pushResponse = await fetch(`${API_URL}/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ deviceId, events }),
          });

          if (pushResponse.ok) {
            const result = await pushResponse.json();
            // Mark successful events as synced
            for (const eventId of result.successful) {
              await db.runAsync(
                `UPDATE outbox_events SET sync_status = 'SYNCED' WHERE event_id = ?`,
                [eventId]
              );
            }
          }
        } catch (error) {
          console.log('Push sync failed:', error);
        }
      }

      // 2. Pull server changes
      try {
        const lastVersion = await db.getFirstAsync<any>(
          "SELECT value FROM sync_metadata WHERE key = 'lastSyncVersion'"
        );
        const lastSyncVersion = parseInt(lastVersion?.value || '0', 10);

        const pullResponse = await fetch(`${API_URL}/sync/pull`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceId: 'student-device-' + (profile?.id || 'unknown'),
            lastSyncVersion,
          }),
        });

        if (pullResponse.ok) {
          const result = await pullResponse.json();

          // Apply changes
          for (const change of result.changes) {
            if (change.entityType === 'gate_pass') {
              const data = change.data as any;
              // Upsert local pass
              await db.runAsync(
                `INSERT OR REPLACE INTO local_gate_passes (id, server_id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, version, sync_status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?)`,
                [
                  data.id, data.id, data.studentId, data.rollNumber, data.studentName,
                  data.destination, data.purpose, data.validFrom, data.validUntil,
                  data.status, data.signature || null, data.version,
                  change.timestamp, new Date().toISOString()
                ]
              );
            }
          }

          // Save new sync version
          const now = new Date().toISOString();
          await db.runAsync(
            `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('lastSyncVersion', ?, ?)`,
            [result.newVersion.toString(), now]
          );

          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch (error) {
        console.log('Pull sync failed:', error);
      }

      await loadPasses();
      await loadPendingCount();
    } catch (error) {
      console.error('Sync error:', error);
    }
  }, [db, isOnline, getToken, profile]);

  return (
    <SyncContext.Provider value={{ isOnline, lastSyncTime, pendingCount, passes, activePass, syncNow, createPassOffline }}>
      {children}
    </SyncContext.Provider>
  );
}

function formatLocalPass(row: any): any {
  return {
    id: row.id,
    serverId: row.server_id,
    studentId: row.student_id,
    rollNumber: row.roll_number,
    studentName: row.student_name,
    destination: row.destination,
    purpose: row.purpose,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    status: row.status,
    signature: row.signature,
    version: row.version,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
