// Only id + name of every team, so the login form can list them. No passwords.
import { route, send } from './_lib/http.js';
import { readCollection } from './_lib/store.js';

export default route(['GET'], async (req, res) => {
  const teams = await readCollection('teams');
  const list = Object.keys(teams)
    .map((id) => ({ id, name: teams[id].name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  send(res, 200, list, { 'Cache-Control': 'public, max-age=0, s-maxage=20, stale-while-revalidate=120' });
});
