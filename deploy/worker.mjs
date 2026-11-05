const MAX_BODY = 1024 * 1024;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

// The same merge as site/core/store.js: per item the newer snapshot wins, attempts and events are unioned by id.
// Data not shaped like {items: {...}} (such as test/w00's) is replaced.
const isWeek = (d) => d?.items && typeof d.items === 'object' && !Array.isArray(d.items);
function unionById(a, b) {
  const seen = new Map();
  for (const x of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) if (x?.id && !seen.has(x.id)) seen.set(x.id, x);
  return [...seen.values()].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
}
function mergeWeek(incoming, stored) {
  if (!isWeek(incoming) || !isWeek(stored)) return incoming;
  const items = {};
  for (const id of new Set([...Object.keys(stored.items), ...Object.keys(incoming.items)])) {
    const n = incoming.items[id], s = stored.items[id];
    if (!n || !s) { items[id] = n || s; continue; }
    const newer = (n.updatedAt || '') >= (s.updatedAt || '') ? n : s;
    items[id] = { ...newer, attempts: unionById(n.attempts, s.attempts), events: unionById(n.events, s.events) };
  }
  return { items };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const user = request.headers.get('oai-authenticated-user-id');
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const match = /^\/api\/state\/([a-z0-9-]+)\/(w\d{2})$/.exec(url.pathname);
      if (!match) return json({ error: 'Not found' }, 404);
      const [, course, week] = match;
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT data, updated_at FROM state WHERE user_id = ? AND course = ? AND week = ?').bind(user, course, week).first();
        return json({ data: row ? JSON.parse(row.data) : null, updatedAt: row?.updated_at ?? null });
      }
      if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
      if (Number(request.headers.get('content-length')) > MAX_BODY) return json({ error: 'Body too large' }, 413);
      const reader = request.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY) { await reader.cancel(); return json({ error: 'Body too large' }, 413); }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let body;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'data')) return json({ error: 'Expected {data: ...}' }, 400);
      const email = request.headers.get('oai-authenticated-user-email');
      // Compare-and-swap on updated_at, which every write moves strictly forward, so a PUT that raced another rereads and merges again.
      for (let tries = 0; tries < 5; tries++) {
        const row = await env.DB.prepare('SELECT data, updated_at FROM state WHERE user_id = ? AND course = ? AND week = ?').bind(user, course, week).first();
        let updatedAt = new Date().toISOString();
        if (row?.updated_at && updatedAt <= row.updated_at) updatedAt = new Date(Date.parse(row.updated_at) + 1).toISOString();
        const data = JSON.stringify(row ? mergeWeek(body.data, JSON.parse(row.data)) : body.data);
        const write = row
          ? env.DB.prepare('UPDATE state SET email = ?, data = ?, updated_at = ? WHERE user_id = ? AND course = ? AND week = ? AND updated_at IS ?').bind(email, data, updatedAt, user, course, week, row.updated_at)
          : env.DB.prepare('INSERT INTO state (user_id, email, course, week, data, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, course, week) DO NOTHING').bind(user, email, course, week, data, updatedAt);
        if ((await write.run()).meta.changes === 1) return json({ updatedAt });
      }
      return json({ error: 'Busy, try again' }, 409);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return new Response('Bad path', { status: 400 }); }
    const file = FILES[path] ?? FILES[path.replace(/\/$/, '') + '/index.html'];
    if (!file) return new Response('Not found', { status: 404 });
    const data = request.method === 'HEAD' ? null : Uint8Array.from(atob(file[1]), c => c.charCodeAt(0));
    return new Response(data, { headers: { 'Content-Type': file[0] } });
  }
};
