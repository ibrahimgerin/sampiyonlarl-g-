import { route, send } from './_lib/http.js';
import { getSession } from './_lib/auth.js';

export default route(['GET'], async (req, res) => {
  const s = getSession(req);
  send(res, 200, s ? { role: s.role, team: s.team } : {});
});
