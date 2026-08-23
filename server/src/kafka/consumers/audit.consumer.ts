import { createConsumer } from '../../config/kafka';
import { TOPICS } from '../topics';

/**
 * Audit consumer - listens to all gate pass and gate event topics
 * to log and process security audits asynchronously.
 */
export async function startAuditConsumer(): Promise<void> {
  const consumer = await createConsumer('gatepass-audit-service');
  if (!consumer) {
    console.log('[AuditConsumer] Kafka not available, skipping consumer initialization');
    return;
  }

  try {
    await consumer.subscribe({
      topics: [
        TOPICS.GATE_PASS_CREATED,
        TOPICS.GATE_PASS_APPROVED,
        TOPICS.GATE_PASS_REJECTED,
        TOPICS.GATE_PASS_CANCELLED,
        TOPICS.GATE_PASS_EXPIRED,
        TOPICS.GATE_OUT,
        TOPICS.GATE_IN,
      ],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const key = message.key?.toString();
        const valueStr = message.value?.toString();
        const value = valueStr ? JSON.parse(valueStr) : {};

        console.log(`[AuditConsumer] Processed ${topic} [${partition}] key=${key}`, value);
      },
    });

    console.log('✓ Kafka Audit Consumer running');
  } catch (error) {
    console.warn('[AuditConsumer] Consumer startup error:', (error as Error).message);
  }
}
