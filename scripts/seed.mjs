import './env.mjs';
// Loads scripts/seed-data.json into your KV database.
//   npm run seed           only fills collections that are still empty
//   npm run seed:reset     wipes teams / matches / players / news first
// Needs KV_REST_API_URL and KV_REST_API_TOKEN (run `vercel env pull .env.local` first).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kv, isMemory } from '../api/_lib/kv.js';
import { COLLECTIONS } from '../api/_lib/store.js';

if (isMemory()) {
  console.error('KV_REST_API_URL / KV_REST_API_TOKEN bulunamadı. Önce `vercel env pull .env.local` çalıştır.');
  process.exit(1);
}
const reset = process.argv.includes('--reset');
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-data.json');
const seed = JSON.parse(fs.readFileSync(file, 'utf8'));

for (const col of COLLECTIONS) {
  const key = `col:${col}`;
  const existing = await kv().hgetall(key);
  if (existing && Object.keys(existing).length && !reset) {
    console.log(`${col}: dolu, atlandı (${Object.keys(existing).length} kayıt)`);
    continue;
  }
  if (reset) await kv().del(key);
  const docs = seed[col] || {};
  if (Object.keys(docs).length) await kv().hset(key, docs);
  console.log(`${col}: ${Object.keys(docs).length} kayıt yüklendi`);
}
await kv().incr('meta:v');
console.log('Bitti.');
