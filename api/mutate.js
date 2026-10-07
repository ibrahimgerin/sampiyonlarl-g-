// All writes. Admin only.
import { route, send, fail, readJson } from './_lib/http.js';
import { getSession } from './_lib/auth.js';
import { COLLECTIONS, sanitize, newId, getDoc, putDoc, removeDoc } from './_lib/store.js';

export default route(['POST'], async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 401, 'Giriş gerekli.');
  if (session.role !== 'admin') return fail(res, 403, 'Bu işlem için yönetim girişi gerekli.');

  const body = await readJson(req, 100_000);
  if (!body || !COLLECTIONS.includes(body.col)) return fail(res, 400, 'Geçersiz istek.');
  const { op, col } = body;
  const id = typeof body.id === 'string' ? body.id : '';
  if (op !== 'add' && !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return fail(res, 400, 'Geçersiz kimlik.');

  try {
    if (op === 'add') {
      const doc = sanitize(col, body.data, { partial: false });
      const newDocId = newId();
      const v = await putDoc(col, newDocId, doc);
      return send(res, 200, { ok: true, id: newDocId, v });
    }
    if (op === 'update') {
      const existing = await getDoc(col, id);
      if (!existing) return fail(res, 404, 'Kayıt bulunamadı.');
      const patch = sanitize(col, body.data, { partial: true });
      const v = await putDoc(col, id, { ...existing, ...patch });
      return send(res, 200, { ok: true, v });
    }
    if (op === 'delete') {
      const v = await removeDoc(col, id);
      return send(res, 200, { ok: true, v });
    }
  } catch (err) {
    return fail(res, 400, err.message);
  }
  fail(res, 400, 'Geçersiz işlem.');
});
