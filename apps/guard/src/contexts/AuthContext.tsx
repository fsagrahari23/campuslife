import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:3000/api';

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

interface AuthContextType {
  user: any;
  profile: any;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, isAuthenticated: false,
  login: async () => {}, logout: async () => {}, getToken: async () => null,
});

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => { loadStoredAuth(); }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await storage.getItem('accessToken');
      const storedUser = await storage.getItem('user');
      const storedProfile = await storage.getItem('profile');
      if (token && storedUser) {
        setUser(JSON.parse(storedUser));
        if (storedProfile) setProfile(JSON.parse(storedProfile));
        setIsAuthenticated(true);
      }
    } catch (error) { console.error('Auth load error:', error); }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) { const data = await response.json(); throw new Error(data.message || 'Login failed'); }
    const data = await response.json();
    await storage.setItem('accessToken', data.accessToken);
    await storage.setItem('refreshToken', data.refreshToken);
    await storage.setItem('user', JSON.stringify(data.user));
    await storage.setItem('profile', JSON.stringify(data.profile));
    setUser(data.user); setProfile(data.profile); setIsAuthenticated(true);
  };

  const logout = async () => {
    await storage.deleteItem('accessToken');
    await storage.deleteItem('refreshToken');
    await storage.deleteItem('user');
    await storage.deleteItem('profile');
    setUser(null); setProfile(null); setIsAuthenticated(false);
  };

  const getToken = async () => storage.getItem('accessToken');

  return (
    <AuthContext.Provider value={{ user, profile, isAuthenticated, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}
