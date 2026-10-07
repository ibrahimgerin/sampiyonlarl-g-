// Small helpers shared by every API route. Plain Node req/res only, so the same
// handlers run on Vercel and in scripts/dev.mjs.
export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function fail(res, status, message) {
  send(res, status, { error: message });
}

export function urlOf(req) {
  return new URL(req.url, 'http://localhost');
}

export async function readJson(req, limit = 1_000_000) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return null; }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) return null;
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

// Browsers always send Origin on cross-site POSTs. If it is present it must match our host.
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket?.remoteAddress || 'unknown').trim();
}

// Wrap a handler with method + same-origin checks and a catch-all error response.
export function route(methods, fn) {
  return async function handler(req, res) {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        return fail(res, 405, 'Yöntem desteklenmiyor.');
      }
      if (req.method !== 'GET' && !sameOrigin(req)) return fail(res, 403, 'İstek reddedildi.');
      await fn(req, res);
    } catch (err) {
      console.error(err);
      fail(res, 500, err && err.message ? err.message : 'Sunucu hatası.');
    }
  };
}
