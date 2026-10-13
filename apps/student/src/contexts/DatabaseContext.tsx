import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DatabaseContextType {
  db: any;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextType>({ db: null, isReady: false });

export function useDatabase() {
  return useContext(DatabaseContext);
}

// Fallback in-memory / AsyncStorage database for browsers without SecureContext / OPFS (e.g. mobile HTTP)
function createFallbackDatabase(prefix: string) {
  const storeKey = `@sqlite_fallback_${prefix}`;

  const VALID_EVENT_TYPES = new Set([
    'GATE_PASS_CREATED', 'GATE_PASS_APPROVED', 'GATE_PASS_REJECTED',
    'GATE_PASS_CANCELLED', 'GATE_PASS_EXPIRED', 'GATE_OUT', 'GATE_IN', 'DEVICE_SYNCED'
  ]);

  const getTables = async (): Promise<Record<string, any[]>> => {
    try {
      const data = await AsyncStorage.getItem(storeKey);
      if (!data) return { local_gate_passes: [], outbox_events: [], sync_metadata: [] };
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.outbox_events)) {
        // Sanitize outbox events to repair any previously corrupted state
        parsed.outbox_events = parsed.outbox_events.map((e: any) => {
          let eventType = e.event_type;
          let aggregateId = e.aggregate_id;
          let payload = e.payload;
          let createdAt = e.created_at;

          if (!VALID_EVENT_TYPES.has(eventType)) {
            // Repaired inverted fields from earlier version
            eventType = 'GATE_PASS_CREATED';
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
      return { local_gate_passes: [], outbox_events: [], sync_metadata: [] };
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
        if (params.length === 13) {
          const [id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, sync_status, created_at, updated_at] = params;
          const existingIdx = tables.local_gate_passes.findIndex(p => p.id === id);
          const row = { id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, sync_status, created_at, updated_at };
          if (existingIdx >= 0) tables.local_gate_passes[existingIdx] = row;
          else tables.local_gate_passes.unshift(row);
        } else if (params.length >= 14) {
          const [id, server_id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, version, sync_status, created_at, updated_at] = params;
          const existingIdx = tables.local_gate_passes.findIndex(p => p.id === id || (server_id && p.server_id === server_id));
          const row = { id, server_id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, version, sync_status, created_at, updated_at };
          if (existingIdx >= 0) tables.local_gate_passes[existingIdx] = row;
          else tables.local_gate_passes.unshift(row);
        }
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
          event_type = 'GATE_PASS_CREATED';
          sync_status = 'PENDING';
        }
        tables.outbox_events = tables.outbox_events || [];
        tables.outbox_events.unshift({
          id,
          event_id,
          event_type: event_type || 'GATE_PASS_CREATED',
          aggregate_id,
          payload,
          sync_status: sync_status || 'PENDING',
          created_at: created_at || new Date().toISOString()
        });
        await saveTables(tables);
      } else if (upper.startsWith('UPDATE LOCAL_GATE_PASSES')) {
        tables.local_gate_passes = tables.local_gate_passes || [];
        const passId = params[params.length - 1];
        const pass = tables.local_gate_passes.find(p => p.id === passId || p.server_id === passId);
        if (pass) {
          if (upper.includes('SERVER_ID')) {
            pass.server_id = params[0];
            pass.sync_status = 'SYNCED';
            pass.updated_at = params[1] || new Date().toISOString();
          } else if (upper.includes('SYNC_STATUS')) {
            pass.sync_status = 'SYNCED';
            pass.updated_at = new Date().toISOString();
          }
        }
        await saveTables(tables);
      } else if (upper.startsWith('UPDATE OUTBOX_EVENTS')) {
        tables.outbox_events = tables.outbox_events || [];
        const eventId = params[params.length - 1];
        const event = tables.outbox_events.find(e => e.event_id === eventId);
        if (event) event.sync_status = 'SYNCED';
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
      if (upper.includes('COUNT(*)') && upper.includes('OUTBOX_EVENTS')) {
        const pending = (tables.outbox_events || []).filter(e => e.sync_status === 'PENDING').length;
        return { count: pending } as T;
      }
      if (upper.includes('LOCAL_GATE_PASSES')) {
        const passId = params[0];
        if (passId) {
          return (tables.local_gate_passes?.find(p => p.id === passId || p.server_id === passId) || null) as T | null;
        }
        return ((tables.local_gate_passes && tables.local_gate_passes[0]) || null) as T | null;
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

  useEffect(() => {
    initDatabase();
  }, []);

  const initDatabase = async () => {
    try {
      // Check if running on web without secure context (OPFS not available)
      if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn('Insecure web context detected: using AsyncStorage fallback database');
        const fallbackDb = createFallbackDatabase('student');
        setDb(fallbackDb);
        setIsReady(true);
        return;
      }

      const database = await SQLite.openDatabaseAsync('student_gatepass.db');

      // Enable WAL mode for better concurrent access
      await database.execAsync('PRAGMA journal_mode = WAL;');

      // Create tables
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS local_gate_passes (
          id TEXT PRIMARY KEY,
          server_id TEXT,
          student_id TEXT NOT NULL,
          roll_number TEXT NOT NULL,
          student_name TEXT NOT NULL,
          destination TEXT NOT NULL,
          purpose TEXT NOT NULL,
          valid_from TEXT NOT NULL,
          valid_until TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          signature TEXT,
          version INTEGER DEFAULT 1,
          sync_status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
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

        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      setDb(database);
      setIsReady(true);
      console.log('SQLite database initialized');
    } catch (error) {
      console.warn('SQLite init error, falling back to AsyncStorage database:', error);
      const fallbackDb = createFallbackDatabase('student');
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
