import { pool, query } from '../config/database';
import { hashPassword } from '../services/auth.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed the database with test data.
 * Creates test students, guards, and an admin user.
 */
async function seed() {
  console.log('Seeding database...');

  try {
    // Check if already seeded
    const existing = await query('SELECT id FROM users LIMIT 1');
    if (existing.length > 0) {
      console.log('Database already has data. Skipping seed.');
      return;
    }

    const passwordHash = await hashPassword('password123');

    // Create admin
    const adminId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      [adminId, 'admin@campus.edu', passwordHash]
    );
    console.log('  ✓ Admin: admin@campus.edu / password123');

    // Create students
    const students = [
      { name: 'Rahul Kumar', rollNumber: '20231234', email: 'rahul@campus.edu', dept: 'Computer Science' },
      { name: 'Priya Sharma', rollNumber: '20231235', email: 'priya@campus.edu', dept: 'Electronics' },
      { name: 'Amit Singh', rollNumber: '20231236', email: 'amit@campus.edu', dept: 'Mechanical' },
    ];

    for (const s of students) {
      const userId = uuidv4();
      const studentId = uuidv4();

      await pool.query(
        `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'student')`,
        [userId, s.email, passwordHash]
      );
      await pool.query(
        `INSERT INTO students (id, user_id, roll_number, name, department) VALUES ($1, $2, $3, $4, $5)`,
        [studentId, userId, s.rollNumber, s.name, s.dept]
      );
      console.log(`  ✓ Student: ${s.email} / password123 (${s.name}, ${s.rollNumber})`);
    }

    // Create guards
    const guards = [
      { name: 'Suresh Patil', badge: 'G001', email: 'guard1@campus.edu' },
      { name: 'Ramesh Verma', badge: 'G002', email: 'guard2@campus.edu' },
    ];

    for (const g of guards) {
      const userId = uuidv4();
      const guardId = uuidv4();

      await pool.query(
        `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'guard')`,
        [userId, g.email, passwordHash]
      );
      await pool.query(
        `INSERT INTO guards (id, user_id, name, badge_number) VALUES ($1, $2, $3, $4)`,
        [guardId, userId, g.name, g.badge]
      );
      console.log(`  ✓ Guard: ${g.email} / password123 (${g.name}, ${g.badge})`);
    }

    console.log('\nSeed complete. All passwords: password123');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
