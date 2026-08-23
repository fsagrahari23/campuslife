import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query, queryOne } from '../config/database';
import { TokenPayload, LoginResponse, UserRole } from '@gatepass/shared-types';

const SALT_ROUNDS = 12;

/**
 * Authenticate user and return JWT tokens.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  // Find user
  const user = await queryOne<{
    id: string;
    email: string;
    password_hash: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM users WHERE email = $1', [email]);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Get profile based on role
  let profile: any;
  if (user.role === 'student') {
    profile = await queryOne('SELECT * FROM students WHERE user_id = $1', [user.id]);
  } else if (user.role === 'guard') {
    profile = await queryOne('SELECT * FROM guards WHERE user_id = $1', [user.id]);
  } else {
    profile = { id: user.id, name: 'Admin' };
  }

  // Generate tokens
  const tokenPayload: TokenPayload = { userId: user.id, role: user.role };
  const accessToken = jwt.sign(tokenPayload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(tokenPayload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    profile: formatProfile(profile, user.role),
  };
}

/**
 * Refresh access token using refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;

    const user = await queryOne<{ id: string; role: UserRole }>(
      'SELECT id, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    const tokenPayload: TokenPayload = { userId: user.id, role: user.role };
    const accessToken = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    return { accessToken };
  } catch {
    throw new Error('Invalid refresh token');
  }
}

/**
 * Hash a password for storage.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function formatProfile(profile: any, role: UserRole): any {
  if (!profile) return null;

  if (role === 'student') {
    return {
      id: profile.id,
      userId: profile.user_id,
      rollNumber: profile.roll_number,
      name: profile.name,
      department: profile.department,
      createdAt: profile.created_at,
    };
  }

  if (role === 'guard') {
    return {
      id: profile.id,
      userId: profile.user_id,
      name: profile.name,
      badgeNumber: profile.badge_number,
      createdAt: profile.created_at,
    };
  }

  return profile;
}
