/**
 * Generate Ed25519 key pair for signing gate passes.
 * Run this once: npm run generate-keys
 * Then add the keys to your .env file.
 */
import { generateKeyPair, publicKeyToBase64 } from '@gatepass/crypto';

async function main() {
  console.log('Generating Ed25519 key pair...\n');

  const keys = await generateKeyPair();

  console.log('Add these to your server .env file:');
  console.log('─'.repeat(60));
  console.log(`ED25519_PRIVATE_KEY=${keys.privateKey}`);
  console.log(`ED25519_PUBLIC_KEY=${keys.publicKey}`);
  console.log('─'.repeat(60));
  console.log('\nPublic key (base64) for mobile apps:');
  console.log(publicKeyToBase64(keys.publicKey));
  console.log('\n⚠️  NEVER share or commit the private key!');
}

main().catch(console.error);
