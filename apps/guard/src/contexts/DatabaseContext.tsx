import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DatabaseContextType {
  db: any;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextType>({ db: null, isReady: false });
export function useDatabase() { return useContext(DatabaseContext); }

function createFallbackDatabase(prefix: string) {
  const storeKey = `@sqlite_fallback_${prefix}`;

  const VALID_EVENT_TYPES = new Set([
    'GATE_PASS_CREATED', 'GATE_PASS_APPROVED', 'GATE_PASS_REJECTED',
    'GATE_PASS_CANCELLED', 'GATE_PASS_EXPIRED', 'GATE_OUT', 'GATE_IN', 'DEVICE_SYNCED'
  ]);

  const getTables = async (): Promise<Record<string, any[]>> => {
    try {
      const data = await AsyncStorage.getItem(storeKey);
      if (!data) return { local_gate_passes: [], local_scan_events: [], outbox_events: [], revocations: [], sync_metadata: [] };
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.outbox_events)) {
        parsed.outbox_events = parsed.outbox_events.map((e: any) => {
          let eventType = e.event_type;
          let aggregateId = e.aggregate_id;
          let payload = e.payload;
          let createdAt = e.created_at;

          if (!VALID_EVENT_TYPES.has(eventType)) {
            eventType = 'GATE_OUT';
            if (typeof aggregateId === 'string' && aggregateId.startsWith('{')) {
              payload = aggregateId;
              aggregateId = e.event_type || e.id;
            }
          }
          if (!createdAt || typeof createdAt !== 'string' || !createdAt.includes('T')) {
            createdAt = new Date().toISOString();
          }
          return {
            ...e,
            event_type: eventType,
            aggregate_id: aggregateId,
            payload,
            created_at: createdAt,
          };
        });
      }
      return parsed;
    } catch {
      return { local_gate_passes: [], local_scan_events: [], outbox_events: [], revocations: [], sync_metadata: [] };
    }
  };

  const saveTables = async (tables: Record<string, any[]>) => {
    try {
      await AsyncStorage.setItem(storeKey, JSON.stringify(tables));
    } catch (e) {
      console.warn('Fallback DB save error:', e);
    }
  };

  return {
    execAsync: async (_sql: string) => {},
    runAsync: async (sql: string, params: any[] = []) => {
      const tables = await getTables();
      const upper = sql.trim().toUpperCase();

      if (upper.startsWith('INSERT INTO LOCAL_GATE_PASSES') || upper.startsWith('INSERT OR REPLACE INTO LOCAL_GATE_PASSES')) {
        tables.local_gate_passes = tables.local_gate_passes || [];
        if (params.length === 11) {
          const [id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, signature, version, updated_at] = params;
          const idx = tables.local_gate_passes.findIndex(p => p.id === id);
          const row = { id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status: 'APPROVED', signature, version, updated_at };
          if (idx >= 0) tables.local_gate_passes[idx] = row;
          else tables.local_gate_passes.unshift(row);
        } else if (params.length >= 12) {
          const [id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, version, updated_at] = params;
          const idx = tables.local_gate_passes.findIndex(p => p.id === id);
          const row = { id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, version, updated_at };
          if (idx >= 0) tables.local_gate_passes[idx] = row;
          else tables.local_gate_passes.unshift(row);
        }
        await saveTables(tables);
      } else if (upper.startsWith('UPDATE LOCAL_GATE_PASSES')) {
        tables.local_gate_passes = tables.local_gate_passes || [];
        const passId = params[params.length - 1];
        const pass = tables.local_gate_passes.find(p => p.id === passId);
        if (pass) {
          if (params.length >= 2) {
            pass.status = params[0];
            pass.updated_at = params[1] || new Date().toISOString();
          }
        }
        await saveTables(tables);
      } else if (upper.startsWith('INSERT INTO LOCAL_SCAN_EVENTS')) {
        const [id, event_id, pass_id, device_id, guard_id, scan_type, result, student_name, roll_number, destination, previous_status, new_status, error_message, timestamp, sync_status, created_at] = params;
        tables.local_scan_events = tables.local_scan_events || [];
        tables.local_scan_events.unshift({ id, event_id, pass_id, device_id, guard_id, scan_type, result, student_name, roll_number, destination, previous_status, new_status, error_message, timestamp, sync_status, created_at });
        await saveTables(tables);
      } else if (upper.startsWith('UPDATE LOCAL_SCAN_EVENTS')) {
        tables.local_scan_events = tables.local_scan_events || [];
        const eventId = params[params.length - 1];
        const item = tables.local_scan_events.find(e => e.event_id === eventId);
        if (item) item.sync_status = 'SYNCED';
        await saveTables(tables);
      } else if (upper.startsWith('INSERT INTO OUTBOX_EVENTS')) {
        let id, event_id, event_type, aggregate_id, payload, sync_status, created_at;
        if (params.length === 7) {
          [id, event_id, event_type, aggregate_id, payload, sync_status, created_at] = params;
        } else if (params.length === 6) {
          [id, event_id, event_type, aggregate_id, payload, created_at] = params;
          sync_status = 'PENDING';
        } else if (params.length === 5) {
          [id, event_id, aggregate_id, payload, created_at] = params;
          event_type = 'GATE_OUT';
          sync_status = 'PENDING';
        }
        tables.outbox_events = tables.outbox_events || [];
        tables.outbox_events.unshift({
          id,
          event_id,
          event_type: event_type || 'GATE_OUT',
          aggregate_id,
          payload,
          sync_status: sync_status || 'PENDING',
          created_at: created_at || new Date().toISOString()
        });
        await saveTables(tables);
        await saveTables(tables);
      } else if (upper.startsWith('UPDATE OUTBOX_EVENTS')) {
        tables.outbox_events = tables.outbox_events || [];
        const eventId = params[params.length - 1];
        const item = tables.outbox_events.find(e => e.event_id === eventId);
        if (item) item.sync_status = 'SYNCED';
        await saveTables(tables);
      } else if (upper.startsWith('INSERT OR REPLACE INTO REVOCATIONS') || upper.startsWith('INSERT INTO REVOCATIONS')) {
        const [id, pass_id, reason, revoked_at, version] = params;
        tables.revocations = tables.revocations || [];
        const idx = tables.revocations.findIndex(r => r.pass_id === pass_id);
        const row = { id, pass_id, reason, revoked_at, version };
        if (idx >= 0) tables.revocations[idx] = row;
        else tables.revocations.unshift(row);
        await saveTables(tables);
      } else if (upper.startsWith('INSERT OR REPLACE INTO SYNC_METADATA') || upper.startsWith('INSERT INTO SYNC_METADATA')) {
        const [key, value, updated_at] = params.length === 2 ? ['lastSyncVersion', params[0], params[1]] : params;
        tables.sync_metadata = tables.sync_metadata || [];
        const idx = tables.sync_metadata.findIndex(m => m.key === key);
        const row = { key, value, updated_at };
        if (idx >= 0) tables.sync_metadata[idx] = row;
        else tables.sync_metadata.push(row);
        await saveTables(tables);
      }
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllAsync: async <T,>(sql: string, _params: any[] = []): Promise<T[]> => {
      const tables = await getTables();
      const upper = sql.trim().toUpperCase();
      if (upper.includes('LOCAL_SCAN_EVENTS')) {
        return (tables.local_scan_events || []).slice(0, 20) as T[];
      }
      if (upper.includes('LOCAL_GATE_PASSES')) {
        return (tables.local_gate_passes || []) as T[];
      }
      if (upper.includes('OUTBOX_EVENTS')) {
        return (tables.outbox_events || []) as T[];
      }
      return [] as T[];
    },
    getFirstAsync: async <T,>(sql: string, params: any[] = []): Promise<T | null> => {
      const tables = await getTables();
      const upper = sql.trim().toUpperCase();
      if (upper.includes('REVOCATIONS')) {
        const passId = params[0];
        return (tables.revocations?.find(r => r.pass_id === passId) || null) as T | null;
      }
      if (upper.includes('LOCAL_GATE_PASSES')) {
        const passId = params[0];
        return (tables.local_gate_passes?.find(p => p.id === passId) || null) as T | null;
      }
      if (upper.includes('COUNT(*)') && upper.includes('OUTBOX_EVENTS')) {
        const pending = (tables.outbox_events || []).filter(e => e.sync_status === 'PENDING').length;
        return { count: pending } as T;
      }
      if (upper.includes('SYNC_METADATA')) {
        const key = params[0] || 'lastSyncVersion';
        return (tables.sync_metadata?.find(m => m.key === key) || null) as T | null;
      }
      return null;
    },
  };
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => { initDatabase(); }, []);

  const initDatabase = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn('Insecure web context detected in Guard: using AsyncStorage fallback database');
        const fallbackDb = createFallbackDatabase('guard');
        setDb(fallbackDb);
        setIsReady(true);
        return;
      }

      const database = await SQLite.openDatabaseAsync('guard_gatepass.db');
      await database.execAsync('PRAGMA journal_mode = WAL;');

      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS local_gate_passes (
          id TEXT PRIMARY KEY,
          student_id TEXT,
          roll_number TEXT,
          student_name TEXT,
          destination TEXT,
          purpose TEXT,
          valid_from TEXT,
          valid_until TEXT,
          status TEXT NOT NULL,
          signature TEXT,
          version INTEGER DEFAULT 1,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_scan_events (
          id TEXT PRIMARY KEY,
          event_id TEXT UNIQUE NOT NULL,
          pass_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          guard_id TEXT NOT NULL,
          scan_type TEXT NOT NULL,
          result TEXT NOT NULL,
          student_name TEXT,
          roll_number TEXT,
          destination TEXT,
          previous_status TEXT,
          new_status TEXT,
          error_message TEXT,
          timestamp TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS outbox_events (
          id TEXT PRIMARY KEY,
          event_id TEXT UNIQUE NOT NULL,
          event_type TEXT NOT NULL,
          aggregate_id TEXT,
          payload TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'PENDING',
          retry_count INTEGER DEFAULT 0,
          last_retry_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS revocations (
          id TEXT PRIMARY KEY,
          pass_id TEXT NOT NULL,
          reason TEXT,
          revoked_at TEXT NOT NULL,
          version INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      setDb(database);
      setIsReady(true);
      console.log('Guard SQLite database initialized');
    } catch (error) {
      console.warn('Guard SQLite init error, using AsyncStorage database fallback:', error);
      const fallbackDb = createFallbackDatabase('guard');
      setDb(fallbackDb);
      setIsReady(true);
    }
  };

  return (
    <DatabaseContext.Provider value={{ db, isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
}
