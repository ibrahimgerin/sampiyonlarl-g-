// Signed, HttpOnly session cookie. No server-side session storage needed.
import crypto from 'node:crypto';

const COOKIE = 'sl_session';
const DAY = 24 * 60 * 60;
let devSecret;

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.VERCEL) throw new Error('SESSION_SECRET ortam değişkeni tanımlı değil (README.md).');
  devSecret ||= crypto.randomBytes(32).toString('hex');
  return devSecret;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => b64(crypto.createHmac('sha256', secret()).update(data).digest());

export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function getSession(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { role: data.role, team: data.team || null };
  } catch {
    return null;
  }
}

function cookieFlags() {
  return `Path=/; HttpOnly; SameSite=Lax${process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function setSession(res, { role, team }, remember) {
  const ttl = remember ? 30 * DAY : 12 * 60 * 60;
  const body = b64(JSON.stringify({ role, team: team || null, exp: Math.floor(Date.now() / 1000) + ttl }));
  const value = `${body}.${sign(body)}`;
  // Without "remember me" the cookie has no Max-Age, so it ends with the browser session.
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; ${cookieFlags()}${remember ? `; Max-Age=${ttl}` : ''}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieFlags()}; Max-Age=0`);
}
