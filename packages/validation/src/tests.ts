import {
  isValidTransition,
  validateTransition,
  getValidNextStates,
  isTerminalState,
  ALL_STATUSES,
} from './state-machine';
import { createGatePassSchema } from './gate-pass';
import { loginSchema } from './auth';
import { pushSyncSchema } from './sync';

function testStateMachine() {
  console.log('--- Testing State Machine Transitions ---');

  // Valid transitions test
  const validTransitions = [
    { from: 'PENDING', to: 'APPROVED' },
    { from: 'PENDING', to: 'REJECTED' },
    { from: 'APPROVED', to: 'OUT' },
    { from: 'APPROVED', to: 'CANCELLED' },
    { from: 'APPROVED', to: 'EXPIRED' },
    { from: 'OUT', to: 'IN' },
  ];

  for (const { from, to } of validTransitions) {
    if (!isValidTransition(from as any, to as any)) {
      throw new Error(`Expected transition ${from} -> ${to} to be VALID`);
    }
    validateTransition(from as any, to as any); // should not throw
  }
  console.log('✓ All 6 valid transitions passed');

  // Invalid transitions test
  const invalidTransitions = [
    { from: 'PENDING', to: 'OUT' },
    { from: 'PENDING', to: 'IN' },
    { from: 'APPROVED', to: 'IN' },
    { from: 'OUT', to: 'OUT' },
    { from: 'IN', to: 'OUT' },
    { from: 'IN', to: 'IN' },
    { from: 'REJECTED', to: 'OUT' },
    { from: 'CANCELLED', to: 'OUT' },
    { from: 'EXPIRED', to: 'OUT' },
  ];

  for (const { from, to } of invalidTransitions) {
    if (isValidTransition(from as any, to as any)) {
      throw new Error(`Expected transition ${from} -> ${to} to be INVALID`);
    }
    let threw = false;
    try {
      validateTransition(from as any, to as any);
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(`Expected validateTransition(${from}, ${to}) to throw an Error`);
    }
  }
  console.log('✓ All 9 invalid transitions correctly rejected');

  // Terminal states
  if (!isTerminalState('IN') || !isTerminalState('REJECTED') || !isTerminalState('CANCELLED') || !isTerminalState('EXPIRED')) {
    throw new Error('Terminal state check failed');
  }
  console.log('✓ Terminal state checks passed');
}

function testValidationSchemas() {
  console.log('--- Testing Zod Schemas ---');

  // Valid gate pass creation
  const now = new Date();
  const validPassData = {
    rollNumber: '20231234',
    studentName: 'Rahul Kumar',
    destination: 'Home',
    purpose: 'Weekend visit with family',
    validFrom: now.toISOString(),
    validUntil: new Date(now.getTime() + 3600000).toISOString(),
  };
  const parsedPass = createGatePassSchema.safeParse(validPassData);
  if (!parsedPass.success) {
    throw new Error(`Expected valid pass schema to pass: ${JSON.stringify(parsedPass.error)}`);
  }

  // Invalid gate pass (end before start)
  const invalidTimePass = {
    ...validPassData,
    validUntil: new Date(now.getTime() - 3600000).toISOString(),
  };
  if (createGatePassSchema.safeParse(invalidTimePass).success) {
    throw new Error('Expected invalid end-time to fail validation');
  }
  console.log('✓ Gate pass schema validation passed');

  // Login schema
  if (!loginSchema.safeParse({ email: 'rahul@campus.edu', password: 'password123' }).success) {
    throw new Error('Expected login schema to pass');
  }
  if (loginSchema.safeParse({ email: 'not-an-email', password: '123' }).success) {
    throw new Error('Expected invalid login to fail');
  }
  console.log('✓ Login schema validation passed');
}

async function run() {
  try {
    testStateMachine();
    testValidationSchemas();
    console.log('\n✅ ALL VALIDATION TESTS PASSED!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

run();
