/**
 * Ed25519 key generation utilities.
 * IMPORTANT: Key generation should ONLY run on the server side.
 * The mobile apps should NEVER have access to the private key.
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, toBase64, fromBase64 } from './encoding';

ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));
ed.etc.sha512Async = (...m: Uint8Array[]) => Promise.resolve(ed.etc.sha512Sync(...m));

export interface KeyPair {
  privateKey: string; // hex-encoded
  publicKey: string;  // hex-encoded
}

/**
 * Generate a new Ed25519 key pair.
 * Call this once during initial server setup and store the keys securely.
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
}

/**
 * Get the public key from a private key.
 */
export async function getPublicKey(privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return bytesToHex(publicKey);
}

/**
 * Export a public key in base64 format for embedding in mobile apps.
 */
export function publicKeyToBase64(publicKeyHex: string): string {
  return toBase64(hexToBytes(publicKeyHex));
}

/**
 * Import a public key from base64 format.
 */
export function publicKeyFromBase64(publicKeyBase64: string): string {
  return bytesToHex(fromBase64(publicKeyBase64));
}
