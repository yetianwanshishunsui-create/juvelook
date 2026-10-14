import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { startServer } from './helpers.js';

let ctx, call;
before(async () => {
  ctx = await startServer();
  call = ctx.client();
});
after(() => ctx.close());

test('未登录访问后台接口返回 401', async () => {
  const { status } = await ctx.client()('GET', '/admin/stats');
  assert.equal(status, 401);
});

test('密码错误登录失败，连续失败后锁定', async () => {
  const c = ctx.client();
  for (let i = 0; i < 5; i++) assert.equal((await c('POST', '/admin/login', { username: 'locked', password: 'x' })).status, 401);
  assert.equal((await c('POST', '/admin/login', { username: 'locked', password: 'x' })).status, 429);
});

test('登录后可访问概览', async () => {
  const login = await call('POST', '/admin/login', { username: 'admin', password: 'test-pass-123' });
  assert.equal(login.status, 200);
  const { body } = await call('GET', '/admin/stats');
  assert.equal(body.totals.doctors, 8);
  assert.equal(body.totals.orgs, 5);
});

test('新增机构：校验必填与重名，自动生成编号', async () => {
  let r = await call('POST', '/admin/orgs', { name: '', city: '' });
  assert.equal(r.status, 400);
  assert.ok(r.body.fields.name);
  r = await call('POST', '/admin/orgs', { name: '华瑅医疗美容门诊部', city: '上海', auth_blue: true });
  assert.equal(r.status, 409);
  r = await call('POST', '/admin/orgs', { name: '测试新机构', city: '厦门', auth_black: true });
  assert.equal(r.status, 201);
  assert.equal(r.body.code, 'JVL-O0006');
});

test('删除机构：名下有医生时拒绝', async () => {
  const r = await call('DELETE', `/admin/orgs/${ctx.ids.orgIds.o1}`);
  assert.equal(r.status, 409);
});

test('医生增改删与撤销认证', async () => {
  let r = await call('POST', '/admin/doctors', { name: '新医生', org_id: ctx.ids.orgIds.o3, mobile: '13900009999', blue_count: 5 });
  assert.equal(r.status, 201);
  const id = r.body.id;
  r = await call('PUT', `/admin/doctors/${id}`, { ...r.body, mobile: '123' });
  assert.equal(r.status, 400);
  r = await call('PUT', `/admin/doctors/${id}`, { name: '新医生', org_id: ctx.ids.orgIds.o3, blue_count: 9, status: 'revoked' });
  assert.equal(r.status, 200);
  const pub = await fetch(`${ctx.base}/doctors/${id}`);
  assert.equal(pub.status, 404);
  r = await call('DELETE', `/admin/doctors/${id}`);
  assert.equal(r.status, 200);
  const logs = await call('GET', '/admin/audit');
  assert.ok(logs.body.items.some((l) => l.action === 'update' && l.detail.includes('countsBefore')));
});

test('医生列表分页与筛选', async () => {
  const r = await call('GET', '/admin/doctors?size=3&page=1');
  assert.equal(r.body.items.length, 3);
  assert.equal(r.body.total, 8);
  const f = await call('GET', '/admin/doctors?city=' + encodeURIComponent('北京'));
  assert.equal(f.body.total, 2);
});

async function workbook(orgRows, docRows) {
  const tpl = await call('GET', '/admin/import/template');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(tpl.body);
  const fill = (name, rows) => {
    const ws = wb.getWorksheet(name);
    ws.spliceRows(2, ws.rowCount);
    rows.forEach((r) => ws.addRow(r));
  };
  fill('机构', orgRows);
  fill('医生', docRows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('Excel 导入：预览标出错误行，修正后整体写入', async () => {
  const bad = await workbook(
    [['厦门导入诊所', '厦门', '厦门市思明区', '是', '否', '']],
    [['导入医生甲', '厦门导入诊所', '13911112222', '', 10, 0], ['导入医生乙', '不存在的机构', '', '', '', '']],
  );
  let r = await call('POST', '/admin/import/preview', bad, { raw: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.summary.errorRows, 1);
  assert.match(r.body.doctors[1].errors[0], /不存在/);
  r = await call('POST', '/admin/import/commit', bad, { raw: true });
  assert.equal(r.status, 400);

  const good = await workbook(
    [['厦门导入诊所', '厦门', '厦门市思明区', '是', '否', ''], ['华瑅医疗美容门诊部', '上海', '新地址', '是', '是', '']],
    [['导入医生甲', '厦门导入诊所', '13911112222', '', 10, 0], ['林薇', '华瑅医疗美容门诊部', '13911113333', '', 1, 1]],
  );
  r = await call('POST', '/admin/import/commit', good, { raw: true });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.summary, { orgCreate: 1, orgUpdate: 1, doctorCreate: 1, doctorUpdate: 1, errorRows: 0 });

  // 已有医生的支数不被导入覆盖
  const lin = (await call('GET', '/admin/doctors?q=' + encodeURIComponent('林薇'))).body.items[0];
  assert.equal(lin.blue_count, 428);
  assert.equal(lin.mobile, '13911113333');
});

test('非 Excel 文件导入报错', async () => {
  const r = await call('POST', '/admin/import/preview', Buffer.from('hello'), { raw: true });
  assert.equal(r.status, 400);
});
