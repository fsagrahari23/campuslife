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

  const getTables = async (): Promise<Record<string, any[]>> => {
    try {
      const data = await AsyncStorage.getItem(storeKey);
      return data ? JSON.parse(data) : { local_gate_passes: [], outbox_events: [], sync_metadata: [] };
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

      if (upper.startsWith('INSERT INTO LOCAL_GATE_PASSES')) {
        const [id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, sync_status, created_at, updated_at] = params;
        tables.local_gate_passes = tables.local_gate_passes || [];
        const existingIdx = tables.local_gate_passes.findIndex(p => p.id === id);
        const row = { id, student_id, roll_number, student_name, destination, purpose, valid_from, valid_until, status, signature, sync_status, created_at, updated_at };
        if (existingIdx >= 0) tables.local_gate_passes[existingIdx] = row;
        else tables.local_gate_passes.unshift(row);
        await saveTables(tables);
      } else if (upper.startsWith('INSERT INTO OUTBOX_EVENTS')) {
        const [id, event_id, event_type, aggregate_id, payload, sync_status, created_at] = params;
        tables.outbox_events = tables.outbox_events || [];
        tables.outbox_events.unshift({ id, event_id, event_type, aggregate_id, payload, sync_status, created_at });
        await saveTables(tables);
      } else if (upper.startsWith('UPDATE LOCAL_GATE_PASSES')) {
        tables.local_gate_passes = tables.local_gate_passes || [];
        if (upper.includes('SYNC_STATUS')) {
          const passId = params[params.length - 1];
          const pass = tables.local_gate_passes.find(p => p.id === passId);
          if (pass) {
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
    getFirstAsync: async <T,>(sql: string, _params: any[] = []): Promise<T | null> => {
      const tables = await getTables();
      const upper = sql.trim().toUpperCase();
      if (upper.includes('COUNT(*)') && upper.includes('OUTBOX_EVENTS')) {
        const pending = (tables.outbox_events || []).filter(e => e.sync_status === 'PENDING').length;
        return { count: pending } as T;
      }
      if (upper.includes('LOCAL_GATE_PASSES')) {
        return ((tables.local_gate_passes && tables.local_gate_passes[0]) || null) as T | null;
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
