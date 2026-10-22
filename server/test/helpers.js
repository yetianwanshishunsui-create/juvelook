import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDemo } from './fixtures.js';
import { upsertAdmin } from '../src/accounts.js';

// 启动一个内存库的测试服务，返回带 Cookie 的请求函数
export async function startServer(appOpts = {}) {
  const db = openDb(':memory:');
  const ids = seedDemo(db);
  upsertAdmin(db, { username: 'admin', password: 'test-pass-123' });
  const server = createApp(db, { rateLimitMax: 10_000, portalEnabled: true, ...appOpts }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const client = () => {
    let cookie = '';
    return async function call(method, path, body, { raw } = {}) {
      const headers = { cookie };
      let payload;
      if (raw) {
        headers['Content-Type'] = 'application/octet-stream';
        payload = body;
      } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
      const res = await fetch(base + path, { method, headers, body: payload });
      const set = res.headers.getSetCookie();
      if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
      const type = res.headers.get('content-type') || '';
      const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
      return { status: res.status, body: data };
    };
  };

  return { db, ids, base, client, close: () => server.close() };
}
