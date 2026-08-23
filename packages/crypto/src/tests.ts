import { generateKeyPair, signPass, verifyPass, decodeQRPayload, isPassValid } from './index';
import { QRPayload } from '@gatepass/shared-types';

async function testCrypto() {
  console.log('--- Testing Ed25519 Cryptographic Pass Signing & Offline Verification ---');

  // 1. Generate server keypair
  const keyPair = await generateKeyPair();
  if (!keyPair.privateKey || !keyPair.publicKey) {
    throw new Error('Key generation failed');
  }
  console.log('✓ Keypair generated successfully');

  // 2. Create sample gate pass QR payload
  const now = new Date();
  const validFrom = new Date(now.getTime() - 10000).toISOString(); // 10s ago
  const validUntil = new Date(now.getTime() + 3600000).toISOString(); // 1 hr later

  const payload: QRPayload = {
    passId: '123e4567-e89b-12d3-a456-426614174000',
    studentId: '987e6543-e21b-34c5-d678-526614174111',
    rollNumber: '20231234',
    studentName: 'Rahul Kumar',
    destination: 'City Library',
    validFrom,
    validUntil,
    version: 1,
  };

  // 3. Server signs the pass
  const signed = await signPass(payload, keyPair.privateKey);
  if (!signed.signature) {
    throw new Error('Signing failed to produce signature');
  }
  console.log('✓ Pass signed with Ed25519 private key');

  // 4. Encode & decode QR string
  const qrString = JSON.stringify(signed);
  const decoded = decodeQRPayload(qrString);
  if (!decoded) {
    throw new Error('Decoding QR payload failed');
  }
  console.log('✓ QR payload encoded and decoded successfully');

  // 5. Offline Guard verification (using ONLY public key)
  const verification = await verifyPass(decoded, keyPair.publicKey);
  if (!verification.valid || !verification.payload) {
    throw new Error(`Verification failed: ${verification.error}`);
  }
  if (verification.payload.rollNumber !== '20231234') {
    throw new Error('Decoded payload mismatch');
  }
  console.log('✓ Offline verification succeeded with public key');

  // 6. Test Tampering: If someone tampers with studentName or passId, signature verification must FAIL!
  const forged = { ...decoded, studentName: 'Imposter Student' };
  const forgedVerification = await verifyPass(forged, keyPair.publicKey);
  if (forgedVerification.valid) {
    throw new Error('Forged/tampered payload was accepted when it should have failed!');
  }
  console.log('✓ Cryptographic anti-tampering verified (tampered payload rejected)');

  // 7. Test Expiration
  const expiredPayload: QRPayload = {
    ...payload,
    validFrom: new Date(now.getTime() - 7200000).toISOString(),
    validUntil: new Date(now.getTime() - 3600000).toISOString(), // expired 1hr ago
  };
  if (isPassValid(expiredPayload)) {
    throw new Error('Expired pass was marked valid');
  }
  if (!isPassValid(payload)) {
    throw new Error('Valid pass was marked invalid');
  }
  console.log('✓ Pass validity period check verified');
}

async function run() {
  try {
    await testCrypto();
    console.log('\n✅ ALL CRYPTO TESTS PASSED!\n');
  } catch (error) {
    console.error('❌ Crypto test failed:', error);
    process.exit(1);
  }
}

run();
