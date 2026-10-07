import { route, send, fail, readJson, clientIp } from './_lib/http.js';
import { setSession, safeEqual } from './_lib/auth.js';
import { kv } from './_lib/kv.js';
import { getDoc } from './_lib/store.js';

export default route(['POST'], async (req, res) => {
  // very small brute-force guard: 8 attempts per minute per IP
  const key = `rl:login:${clientIp(req)}`;
  const tries = await kv().incr(key);
  if (tries === 1) await kv().expire(key, 60);
  if (tries > 8) return fail(res, 429, 'Çok fazla deneme.');

  const body = await readJson(req, 10_000);
  if (!body || typeof body.password !== 'string' || !body.password) return fail(res, 400, 'Şifre gerekli.');
  const remember = body.remember === true;

  if (body.role === 'admin') {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return fail(res, 500, 'ADMIN_PASSWORD ortam değişkeni tanımlı değil.');
    if (!safeEqual(body.password, expected)) return fail(res, 401, 'Şifre hatalı.');
    setSession(res, { role: 'admin' }, remember);
    return send(res, 200, { ok: true, role: 'admin' });
  }

  if (body.role === 'team' && typeof body.team === 'string') {
    const team = await getDoc('teams', body.team);
    if (!team || !safeEqual(body.password, team.password || '')) return fail(res, 401, 'Şifre hatalı.');
    setSession(res, { role: 'team', team: body.team }, remember);
    return send(res, 200, { ok: true, role: 'team', team: body.team });
  }

  return fail(res, 400, 'Geçersiz istek.');
});
