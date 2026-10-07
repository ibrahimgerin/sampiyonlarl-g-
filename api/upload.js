// Logo / photo upload. The browser resizes the picture first, so it stays small enough for KV.
import crypto from 'node:crypto';
import { route, send, fail, readJson } from './_lib/http.js';
import { getSession } from './_lib/auth.js';
import { kv } from './_lib/kv.js';

export default route(['POST'], async (req, res) => {
  const session = getSession(req);
  if (!session || session.role !== 'admin') return fail(res, 403, 'Bu işlem için yönetim girişi gerekli.');
  const body = await readJson(req, 1_000_000);
  const dataUrl = body && body.dataUrl;
  if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    return fail(res, 400, 'Geçersiz görsel.');
  }
  if (dataUrl.length > 600_000) return fail(res, 413, 'Görsel çok büyük.');
  const id = crypto.randomBytes(12).toString('hex');
  await kv().set(`img:${id}`, dataUrl);
  send(res, 200, { url: `/api/img?id=${id}` });
});
