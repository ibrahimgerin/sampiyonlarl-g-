import { route, fail, urlOf } from './_lib/http.js';
import { kv } from './_lib/kv.js';

export default route(['GET'], async (req, res) => {
  const id = urlOf(req).searchParams.get('id') || '';
  if (!/^[a-z0-9]{10,40}$/.test(id)) return fail(res, 400, 'Geçersiz kimlik.');
  const dataUrl = await kv().get(`img:${id}`);
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return fail(res, 404, 'Görsel bulunamadı.');
  res.statusCode = 200;
  res.setHeader('Content-Type', m[1]);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(Buffer.from(m[2], 'base64'));
});
