/**
 * Ed25519 Public Verification Key for Gate Pass QR codes.
 * This public key is bundled at build time so the Guard App
 * can verify signatures 100% OFFLINE without any network access.
 *
 * Notice: This is ONLY the public key. The server private key is never stored here.
 */
export const DEFAULT_PUBLIC_KEY = '9e14b11b370e865599cc8137eef766b22260d8dc0c5a59fb6c9b914934d6c6fe';
