import app from './app';
import { config } from './config';
import { pool } from './config/database';
import { disconnectKafka } from './config/kafka';
import { startExpirationScheduler } from './services/expiration.service';
import { startAuditConsumer, startAnalyticsConsumer } from './kafka';

async function main() {
  try {
    // Verify database connection
    await pool.query('SELECT 1');
    console.log('✓ PostgreSQL connected');

    // Start expiration scheduler
    startExpirationScheduler();

    // Start Kafka consumers (non-blocking)
    startAuditConsumer().catch(console.warn);
    startAnalyticsConsumer().catch(console.warn);

    // Start server
    app.listen(config.port, () => {
      console.log(`✓ Server running on port ${config.port}`);
      console.log(`  Environment: ${config.nodeEnv}`);
      console.log(`  Health: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await disconnectKafka();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await disconnectKafka();
  await pool.end();
  process.exit(0);
});

main();
