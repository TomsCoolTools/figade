// Makes the ECDSA P-256 key pair that signs unlock tokens.
//   npm run keys          -> production: writes keys/public-key.json and prints
//                            the private key to store as a Cloudflare secret
//   (dev keys are made automatically in .dev/ by scripts/dev.js)

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function makeKeyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
  };
}

export async function devKeys(root) {
  const file = path.join(root, '.dev', 'keys.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const keys = await makeKeyPair();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(keys, null, 2));
  return keys;
}

// Run directly (not imported)? pathToFileURL makes this work on Windows paths too.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { publicJwk, privateJwk } = await makeKeyPair();
  fs.writeFileSync('keys/public-key.json', JSON.stringify(publicJwk, null, 2) + '\n');
  console.log('Wrote keys/public-key.json (commit this).\n');
  console.log('Store the private key as a secret named UNLOCK_PRIVATE_KEY in the Cloudflare Pages project:');
  console.log('  npx wrangler pages secret put UNLOCK_PRIVATE_KEY');
  console.log('and paste this when asked (keep it secret, never commit it):\n');
  console.log(JSON.stringify(privateJwk));
}
