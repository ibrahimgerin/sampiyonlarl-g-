// Everything the app shows. Needs a valid session; passwords are only sent to admins.
import { route, send, fail, urlOf } from './_lib/http.js';
import { getSession } from './_lib/auth.js';
import { readAll, version } from './_lib/store.js';

export default route(['GET'], async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 401, 'Giriş gerekli.');
  const known = Number(urlOf(req).searchParams.get('v'));
  if (Number.isFinite(known) && known >= 0 && (await version()) === known) {
    return send(res, 200, { unchanged: true, v: known });
  }
  send(res, 200, await readAll({ admin: session.role === 'admin' }));
});
