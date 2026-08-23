// User roles
export type UserRole = 'student' | 'guard' | 'admin';

// User entity
export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// Student profile
export interface Student {
  id: string;
  userId: string;
  rollNumber: string;
  name: string;
  department?: string;
  createdAt: string;
}

// Guard profile
export interface Guard {
  id: string;
  userId: string;
  name: string;
  badgeNumber?: string;
  createdAt: string;
}

// Auth request/response
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  profile: Student | Guard;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
