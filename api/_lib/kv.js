// Redis/KV client.
// Vercel KV (Upstash Redis) is connected through the marketplace integration, which
// injects KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
// Without those variables a small in-memory store is used so `npm run dev` works offline.
import { Redis } from '@upstash/redis';

let client;

class MemoryKV {
  constructor() {
    this.data = new Map();
    this.timers = new Map();
  }
  _clone(v) {
    return v === undefined ? v : JSON.parse(JSON.stringify(v));
  }
  async get(key) {
    return this._clone(this.data.get(key) ?? null);
  }
  async set(key, value, opts) {
    this.data.set(key, this._clone(value));
    if (opts && opts.ex) await this.expire(key, opts.ex);
    return 'OK';
  }
  async del(key) {
    this.data.delete(key);
    return 1;
  }
  async incr(key) {
    const n = Number(this.data.get(key) || 0) + 1;
    this.data.set(key, n);
    return n;
  }
  async expire(key, seconds) {
    clearTimeout(this.timers.get(key));
    const t = setTimeout(() => this.data.delete(key), seconds * 1000);
    t.unref?.();
    this.timers.set(key, t);
    return 1;
  }
  async hgetall(key) {
    const h = this.data.get(key);
    if (!h || !Object.keys(h).length) return null;
    return this._clone(h);
  }
  async hget(key, field) {
    const h = this.data.get(key);
    return this._clone(h && h[field] !== undefined ? h[field] : null);
  }
  async hset(key, obj) {
    const h = this.data.get(key) || {};
    for (const [f, v] of Object.entries(obj)) h[f] = this._clone(v);
    this.data.set(key, h);
    return Object.keys(obj).length;
  }
  async hdel(key, ...fields) {
    const h = this.data.get(key);
    if (!h) return 0;
    let n = 0;
    for (const f of fields) if (f in h) { delete h[f]; n++; }
    return n;
  }
}

export function isMemory() {
  return !(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export function kv() {
  if (client) return client;
  if (isMemory()) {
    if (process.env.VERCEL) {
      throw new Error('KV bağlantısı yok: Vercel projesine bir KV / Upstash Redis veritabanı bağla (README.md).');
    }
    console.warn('[kv] KV_REST_API_URL tanımlı değil, bellek içi geçici veritabanı kullanılıyor.');
    client = new MemoryKV();
  } else {
    client = new Redis({
      url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return client;
}
