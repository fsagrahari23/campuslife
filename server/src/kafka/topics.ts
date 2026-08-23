export const TOPICS = {
  GATE_PASS_CREATED: 'gate-pass.created',
  GATE_PASS_APPROVED: 'gate-pass.approved',
  GATE_PASS_REJECTED: 'gate-pass.rejected',
  GATE_PASS_CANCELLED: 'gate-pass.cancelled',
  GATE_PASS_EXPIRED: 'gate-pass.expired',
  GATE_OUT: 'gate.out',
  GATE_IN: 'gate.in',
  DEVICE_SYNCED: 'device.synced',
} as const;

export type TopicName = typeof TOPICS[keyof typeof TOPICS];
