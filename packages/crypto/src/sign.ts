/**
 * Ed25519 signing for gate pass QR payloads.
 * This module is used SERVER-SIDE ONLY.
 * The private key must NEVER be shipped to mobile applications.
 */

import * as ed from '@noble/ed25519';
import { QRPayload, SignedQRPayload } from '@gatepass/shared-types';
import { hexToBytes, bytesToHex, stringToBytes } from './encoding';

/**
 * Sign a gate pass payload using Ed25519.
 * Returns a SignedQRPayload with the signature attached.
 *
 * @param payload - The QR payload data to sign
 * @param privateKeyHex - The server's Ed25519 private key in hex format
 * @returns SignedQRPayload with cryptographic signature
 */
export async function signPass(
  payload: QRPayload,
  privateKeyHex: string
): Promise<SignedQRPayload> {
  // Create a canonical string representation of the payload for signing
  const message = canonicalizePayload(payload);
  const messageBytes = stringToBytes(message);
  const privateKey = hexToBytes(privateKeyHex);

  // Sign with Ed25519
  const signature = await ed.signAsync(messageBytes, privateKey);

  return {
    ...payload,
    signature: bytesToHex(signature),
  };
}

/**
 * Create a canonical string representation of the payload.
 * This ensures consistent signing/verification across platforms.
 * Fields are sorted alphabetically to prevent ordering issues.
 */
export function canonicalizePayload(payload: QRPayload): string {
  const ordered = {
    destination: payload.destination,
    passId: payload.passId,
    rollNumber: payload.rollNumber,
    studentId: payload.studentId,
    studentName: payload.studentName,
    validFrom: payload.validFrom,
    validUntil: payload.validUntil,
    version: payload.version,
  };
  return JSON.stringify(ordered);
}

/**
 * Encode a signed QR payload to a string suitable for QR code encoding.
 * Uses JSON + base64 for compact representation.
 */
export function encodeQRPayload(signedPayload: SignedQRPayload): string {
  return JSON.stringify(signedPayload);
}
