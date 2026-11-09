// Ends temporary public sharing: removes the sharing env block and restores local defaults.
// Does not touch credentials, the Razorpay ngrok tunnel, Docker volumes or any data.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const target = resolve(root, process.argv[2] || '.env.docker.local');
if (!existsSync(target)) { console.error(`Environment file not found: ${target}`); process.exit(1); }

const original = readFileSync(target, 'utf8');
const updated = original.replace(/\n?# >>> TEMPORARY PUBLIC SHARING[\s\S]*?# <<< TEMPORARY PUBLIC SHARING\n?/, '\n');

if (updated === original) {
  console.log('No temporary sharing block found; nothing to remove.');
} else {
  writeFileSync(target, updated, { mode: 0o600 });
  console.log('Removed the temporary sharing block (CORS_ORIGINS, S3_PUBLIC_ENDPOINT, S3_PUBLIC_HOST, NEXT_PUBLIC_DEMO_MODE).');
}

console.log('\nNow finish stopping public access:');
console.log('  1. Stop the tunnel:   taskkill /IM cloudflared.exe /F');
console.log('  2. Rebuild locally:   docker compose --env-file .env.docker.local up -d --build api-gateway web');
console.log('\nThe Razorpay ngrok tunnel on port 4000 is unaffected.');
