import { z } from 'zod';

/**
 * Zod schemas for gate pass validation.
 * Shared between mobile apps and backend.
 */

// Create gate pass request schema
export const createGatePassSchema = z.object({
  rollNumber: z
    .string()
    .min(1, 'Roll number is required')
    .max(50, 'Roll number is too long'),
  studentName: z
    .string()
    .min(1, 'Student name is required')
    .max(255, 'Name is too long'),
  destination: z
    .string()
    .min(1, 'Destination is required')
    .max(255, 'Destination is too long'),
  purpose: z
    .string()
    .min(1, 'Purpose is required')
    .max(1000, 'Purpose is too long'),
  validFrom: z
    .string()
    .datetime({ message: 'Valid from must be a valid ISO 8601 datetime' }),
  validUntil: z
    .string()
    .datetime({ message: 'Valid until must be a valid ISO 8601 datetime' }),
}).refine(
  (data) => new Date(data.validUntil) > new Date(data.validFrom),
  { message: 'End time must be after start time', path: ['validUntil'] }
);

// Gate pass status enum for Zod
export const gatePassStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'OUT',
  'IN',
  'EXPIRED',
]);

// Gate pass response schema
export const gatePassResponseSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  rollNumber: z.string(),
  studentName: z.string(),
  destination: z.string(),
  purpose: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
  status: gatePassStatusSchema,
  signature: z.string().nullable().optional(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateGatePassInput = z.infer<typeof createGatePassSchema>;
export type GatePassStatusInput = z.infer<typeof gatePassStatusSchema>;
