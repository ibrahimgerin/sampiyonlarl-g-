import './env.mjs';
// Local dev server: serves /public and runs the /api handlers. No Vercel CLI needed.
// With KV_REST_API_URL / KV_REST_API_TOKEN set (e.g. from `vercel env pull .env.local`) it talks to your real KV;
// otherwise it uses an in-memory store pre-filled from scripts/seed-data.json.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { kv, isMemory } from '../api/_lib/kv.js';
import { COLLECTIONS } from '../api/_lib/store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

if (isMemory()) {
  const seed = JSON.parse(fs.readFileSync(path.join(root, 'scripts/seed-data.json'), 'utf8'));
  for (const col of COLLECTIONS) await kv().hset(`col:${col}`, seed[col] || {});
  await kv().set('meta:v', 1);
  process.env.ADMIN_PASSWORD ||= 'admin123';
  console.log('Bellek içi veritabanı örnek verilerle dolduruldu. Yönetim şifresi: ' + process.env.ADMIN_PASSWORD);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z-]/g, '');
      const file = path.join(root, 'api', name + '.js');
      if (!name || !fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"Bulunamadı"}'); }
      const mod = await import(pathToFileURL(file).href);
      return mod.default(req, res);
    }
    let rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.resolve(root, 'public', '.' + decodeURIComponent(rel));
    if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404; return res.end('Bulunamadı');
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500; res.end('Sunucu hatası');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
