import fs from 'fs';
import path from 'path';
import { pool, query, queryOne } from '../config/database';

/**
 * Simple SQL migration runner.
 * Reads .sql files from the migrations directory and applies them in order.
 */
async function migrate() {
  console.log('Running database migrations...');

  try {
    // Ensure migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = parseInt(file.split('_')[0], 10);
      const name = file;

      // Check if already applied
      const existing = await queryOne(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (existing) {
        console.log(`  ✓ ${name} (already applied)`);
        continue;
      }

      // Read and execute SQL
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await pool.query(sql);

      // Record migration
      await pool.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [version, name]
      );

      console.log(`  ✓ ${name} (applied)`);
    }

    console.log('Migrations complete.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
