import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query, queryOne, withTransaction } from '../config/database';
import { TokenPayload, LoginResponse, UserRole } from '@gatepass/shared-types';
import { RegisterInput } from '@gatepass/validation';

const SALT_ROUNDS = 12;

/**
 * Register a new student account.
 */
export async function register(data: RegisterInput): Promise<LoginResponse> {
  const existingUser = await queryOne('SELECT id FROM users WHERE email = $1', [data.email]);
  if (existingUser) {
    throw new Error('An account with this email already exists');
  }

  const existingRoll = await queryOne('SELECT id FROM students WHERE roll_number = $1', [data.rollNumber]);
  if (existingRoll) {
    throw new Error('An account with this roll number already exists');
  }

  const passwordHash = await hashPassword(data.password);
  const userId = uuidv4();
  const studentId = uuidv4();
  const now = new Date().toISOString();

  return withTransaction(async (client) => {
    const userRes = await client.query(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'student', $4, $4)
       RETURNING id, email, role, created_at, updated_at`,
      [userId, data.email, passwordHash, now]
    );

    const studentRes = await client.query(
      `INSERT INTO students (id, user_id, roll_number, name, department, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [studentId, userId, data.rollNumber, data.name, data.department || null, now]
    );

    const user = userRes.rows[0];
    const student = studentRes.rows[0];

    const tokenPayload: TokenPayload = { userId: user.id, role: 'student' };
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
      profile: formatProfile(student, 'student'),
    };
  });
}

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
