import { route, send } from './_lib/http.js';
import { clearSession } from './_lib/auth.js';

export default route(['POST'], async (req, res) => {
  clearSession(res);
  send(res, 200, { ok: true });
});
