const MAX_BODY = 1024 * 1024;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

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
      const updatedAt = new Date().toISOString();
      await env.DB.prepare('INSERT INTO state (user_id, email, course, week, data, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, course, week) DO UPDATE SET email = excluded.email, data = excluded.data, updated_at = excluded.updated_at').bind(user, request.headers.get('oai-authenticated-user-email'), course, week, JSON.stringify(body.data), updatedAt).run();
      return json({ updatedAt });
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
