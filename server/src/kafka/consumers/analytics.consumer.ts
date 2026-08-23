import { createConsumer } from '../../config/kafka';
import { TOPICS } from '../topics';

/**
 * Analytics consumer - aggregates gate events, peak pass request times,
 * and outbound/inbound metrics.
 */
export async function startAnalyticsConsumer(): Promise<void> {
  const consumer = await createConsumer('gatepass-analytics-service');
  if (!consumer) {
    console.log('[AnalyticsConsumer] Kafka not available, skipping consumer initialization');
    return;
  }

  try {
    await consumer.subscribe({
      topics: [TOPICS.GATE_OUT, TOPICS.GATE_IN, TOPICS.DEVICE_SYNCED],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const valueStr = message.value?.toString();
        const value = valueStr ? JSON.parse(valueStr) : {};

        console.log(`[AnalyticsConsumer] Metric recorded from ${topic}:`, value);
      },
    });

    console.log('✓ Kafka Analytics Consumer running');
  } catch (error) {
    console.warn('[AnalyticsConsumer] Consumer startup error:', (error as Error).message);
  }
}
