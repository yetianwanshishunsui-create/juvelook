import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { normalizeCode } from '../src/scan.js';
import { signJsapi } from '../src/wechat.js';

let ctx, call;
before(async () => {
  ctx = await startServer();
  // 王砚舟：成都机构仅授权 Volume
  ctx.db.prepare(`UPDATE doctors SET mobile = '13900000006' WHERE name = '王砚舟'`).run();
  call = ctx.client();
});
after(() => ctx.close());

test('医生登录：编号 + 手机号', async () => {
  assert.equal((await call('POST', '/portal/login', { code: 'JVL-D0006', mobile: '13900000000' })).status, 401);
  assert.equal((await call('POST', '/portal/login', { code: 'jvl-d0006', mobile: '139 0000 0006' })).status, 200);
  const me = await call('GET', '/portal/me');
  assert.equal(me.body.name, '王砚舟');
  assert.deepEqual(me.body.counts, { blue: null, black: 274 });
});

test('扫码核销：Volume 码累加，重复扫拒绝', async () => {
  let r = await call('POST', '/portal/scan', { code: '861738800000000002' });
  assert.equal(r.status, 200);
  assert.equal(r.body.kind, 'black');
  assert.equal(r.body.counts.black, 275);
  r = await call('POST', '/portal/scan', { code: '861738800000000002' });
  assert.equal(r.status, 409);
  const pub = await fetch(`${ctx.base}/doctors/${ctx.ids.doctorIds['王砚舟']}`).then((x) => x.json());
  assert.equal(pub.counts.black, 275);
});

test('扫码核销：未授权品类、无法识别、过期均拒绝', async () => {
  assert.equal((await call('POST', '/portal/scan', { code: '861738800000000001' })).status, 403);
  assert.equal((await call('POST', '/portal/scan', { code: '861738800000000000' })).status, 422);
  assert.equal((await call('POST', '/portal/scan', { code: '861738800000009999' })).status, 422);
});

test('扫码核销：窜货标记照常核销并提示', async () => {
  const r = await call('POST', '/portal/scan', { code: '761738800000000012' });
  assert.equal(r.status, 200);
  assert.equal(r.body.diverted, true);
});

test('验真服务不可用返回 503，且不计数', async () => {
  const c = await startServer({ verifier: async () => { const { VerifyUnavailable } = await import('../src/verify.js'); throw new VerifyUnavailable('down'); } });
  c.db.prepare(`UPDATE doctors SET mobile = '13900000006' WHERE name = '王砚舟'`).run();
  const cl = c.client();
  await cl('POST', '/portal/login', { code: 'JVL-D0006', mobile: '13900000006' });
  assert.equal((await cl('POST', '/portal/scan', { code: '861738800000000004' })).status, 503);
  assert.equal(c.db.prepare('SELECT COUNT(*) AS n FROM scans').get().n, 0);
  c.close();
});

test('撤销认证后医生端会话失效', async () => {
  ctx.db.prepare(`UPDATE doctors SET status = 'revoked' WHERE name = '王砚舟'`).run();
  assert.equal((await call('GET', '/portal/me')).status, 401);
  ctx.db.prepare(`UPDATE doctors SET status = 'active' WHERE name = '王砚舟'`).run();
});

test('防伪码规范化：URL 取 code 参数、去空白', () => {
  assert.equal(normalizeCode('https://x.cn/v?code=8617 3880 0001'), '861738800001');
  assert.equal(normalizeCode(' 86173880000053324958 '), '86173880000053324958');
});

test('JS-SDK 签名与微信官方示例一致', () => {
  // 微信公众平台文档附录 1 的示例值
  const sig = signJsapi({
    ticket: 'sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg',
    nonceStr: 'Wm3WZYTPz0wzccnW',
    timestamp: 1414587457,
    url: 'http://mp.weixin.qq.com?params=value#hash',
  });
  assert.equal(sig, '0f9de62fce790f9a083d5c99e95740ceb90c27ed');
});
