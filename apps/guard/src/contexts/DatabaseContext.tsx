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

  const getTables = async (): Promise<Record<string, any[]>> => {
    try {
      const data = await AsyncStorage.getItem(storeKey);
      return data ? JSON.parse(data) : { local_gate_passes: [], local_scan_events: [], outbox_events: [], revocations: [], sync_metadata: [] };
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

      if (upper.startsWith('INSERT INTO LOCAL_GATE_PASSES')) {
        const [id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, signature, version, updated_at] = params;
        tables.local_gate_passes = tables.local_gate_passes || [];
        const idx = tables.local_gate_passes.findIndex(p => p.id === id);
        const row = { id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status: 'APPROVED', signature, version, updated_at };
        if (idx >= 0) tables.local_gate_passes[idx] = row;
        else tables.local_gate_passes.unshift(row);
        await saveTables(tables);
      } else if (upper.startsWith('INSERT INTO LOCAL_SCAN_EVENTS')) {
        const [id, event_id, pass_id, device_id, guard_id, scan_type, result, student_name, roll_number, destination, previous_status, new_status, error_message, timestamp, sync_status, created_at] = params;
        tables.local_scan_events = tables.local_scan_events || [];
        tables.local_scan_events.unshift({ id, event_id, pass_id, device_id, guard_id, scan_type, result, student_name, roll_number, destination, previous_status, new_status, error_message, timestamp, sync_status, created_at });
        await saveTables(tables);
      } else if (upper.startsWith('INSERT INTO OUTBOX_EVENTS')) {
        const [id, event_id, event_type, aggregate_id, payload, sync_status, created_at] = params;
        tables.outbox_events = tables.outbox_events || [];
        tables.outbox_events.unshift({ id, event_id, event_type, aggregate_id, payload, sync_status, created_at });
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
