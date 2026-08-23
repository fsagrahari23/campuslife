/**
 * Ed25519 verification for gate pass QR payloads.
 * This module runs on MOBILE DEVICES (Guard App) for offline verification.
 * It uses ONLY the public key — the private key is never present here.
 */

import * as ed from '@noble/ed25519';
import { QRPayload, SignedQRPayload } from '@gatepass/shared-types';
import { hexToBytes, stringToBytes } from './encoding';
import { canonicalizePayload } from './sign';

export interface VerificationResult {
  valid: boolean;
  payload?: QRPayload;
  error?: string;
}

/**
 * Verify an Ed25519 signature on a gate pass QR payload.
 * This can be done completely offline — no network required.
 *
 * @param signedPayload - The signed QR payload to verify
 * @param publicKeyHex - The server's Ed25519 public key in hex format
 * @returns VerificationResult with validity and decoded payload
 */
export async function verifyPass(
  signedPayload: SignedQRPayload,
  publicKeyHex: string
): Promise<VerificationResult> {
  try {
    // Extract the payload without signature for verification
    const payload: QRPayload = {
      passId: signedPayload.passId,
      studentId: signedPayload.studentId,
      rollNumber: signedPayload.rollNumber,
      studentName: signedPayload.studentName,
      destination: signedPayload.destination,
      validFrom: signedPayload.validFrom,
      validUntil: signedPayload.validUntil,
      version: signedPayload.version,
    };

    // Recreate the canonical message that was signed
    const message = canonicalizePayload(payload);
    const messageBytes = stringToBytes(message);

    // Convert hex strings to bytes
    const signature = hexToBytes(signedPayload.signature);
    const publicKey = hexToBytes(publicKeyHex);

    // Verify the Ed25519 signature
    const isValid = await ed.verifyAsync(signature, messageBytes, publicKey);

    if (!isValid) {
      return { valid: false, error: 'Invalid signature — QR code may be forged' };
    }

    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Decode a QR code string into a SignedQRPayload.
 * Returns null if the string is not a valid payload.
 */
export function decodeQRPayload(qrData: string): SignedQRPayload | null {
  try {
    const parsed = JSON.parse(qrData);

    // Validate required fields
    if (
      !parsed.passId ||
      !parsed.studentId ||
      !parsed.rollNumber ||
      !parsed.validFrom ||
      !parsed.validUntil ||
      !parsed.signature
    ) {
      return null;
    }

    return parsed as SignedQRPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a pass is within its validity period.
 */
export function isPassValid(payload: QRPayload, now?: Date): boolean {
  const currentTime = now || new Date();
  const validFrom = new Date(payload.validFrom);
  const validUntil = new Date(payload.validUntil);
  return currentTime >= validFrom && currentTime <= validUntil;
}
