import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let isConnected = false;

/**
 * Initialize Kafka client lazily.
 * Kafka is optional — the system works without it.
 */
function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 5,
      },
    });
  }
  return kafka;
}

/**
 * Get or create the Kafka producer.
 * Returns null if Kafka is unavailable.
 */
export async function getProducer(): Promise<Producer | null> {
  try {
    if (!producer) {
      producer = getKafka().producer();
    }
    if (!isConnected) {
      await producer.connect();
      isConnected = true;
      console.log('Kafka producer connected');
    }
    return producer;
  } catch (error) {
    console.warn('Kafka producer unavailable:', (error as Error).message);
    return null;
  }
}

/**
 * Create a Kafka consumer for a specific group.
 */
export async function createConsumer(groupId: string): Promise<Consumer | null> {
  try {
    const consumer = getKafka().consumer({ groupId });
    await consumer.connect();
    console.log(`Kafka consumer [${groupId}] connected`);
    return consumer;
  } catch (error) {
    console.warn(`Kafka consumer [${groupId}] unavailable:`, (error as Error).message);
    return null;
  }
}

/**
 * Publish an event to a Kafka topic.
 * Fails silently if Kafka is unavailable — events are already in PostgreSQL.
 */
export async function publishEvent(topic: string, key: string, value: Record<string, unknown>): Promise<void> {
  try {
    const prod = await getProducer();
    if (!prod) {
      console.warn(`Kafka unavailable, skipping publish to ${topic}`);
      return;
    }
    await prod.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(value),
          timestamp: Date.now().toString(),
        },
      ],
    });
  } catch (error) {
    console.warn(`Failed to publish to ${topic}:`, (error as Error).message);
  }
}

/**
 * Gracefully disconnect Kafka.
 */
export async function disconnectKafka(): Promise<void> {
  try {
    if (producer && isConnected) {
      await producer.disconnect();
      isConnected = false;
    }
  } catch (error) {
    console.warn('Kafka disconnect error:', (error as Error).message);
  }
}
