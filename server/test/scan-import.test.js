import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { startServer } from './helpers.js';
import { classifyImported, normalizeTime } from '../src/scan-import.js';

// 与客户小程序「扫码验真记录数据导出」表格相同的列
const HEAD = ['用户ID', '用户姓名', '手机号', '用户身份', '获得积分', '验证结果', '渠道码', '产品名称', '品牌名称', '产品标识', '批次号', '产品名称（显示）', '生产日期', '使用期限', '公司名称', '查询次数', '验证时间'];
const BLUE_FULL = 'JUVELOOK聚乳酸面部填充剂[Juvelook-C（50mg/瓶）*1瓶/盒]';
const udi = (serial) => `0118800051300185172809081 0JC26094121JC260941${serial}`.replace(' ', '');

function row({ phone, role = '医生身份', result = '正常', code, short = 'JUVELOOK蓝瓶', full = BLUE_FULL, time = '2026-10-22 11:54:41' }) {
  return ['1', '测试昵称', phone, role, '50', result, '', full, '代理类产品', code, 'JC260941', short, '2026-09-09', '2028-09-08', 'null', '1', time];
}

async function xlsx(rows, head = HEAD) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('扫码验真记录数据导出.xlsx');
  ws.addRow(head);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

let ctx, call;
before(async () => {
  ctx = await startServer();
  const setMobile = ctx.db.prepare('UPDATE doctors SET mobile = ? WHERE name = ?');
  setMobile.run('13900000001', '林薇'); // 上海机构，两品类均授权，JUVELOOK 428 / Volume 216
  setMobile.run('13900000006', '王砚舟'); // 成都机构，仅授权 Volume
  call = ctx.client();
  await call('POST', '/admin/login', { username: 'admin', password: 'test-pass-123' });
});
after(() => ctx.close());

test('品类判定与时间格式', () => {
  assert.equal(classifyImported('JUVELOOK蓝瓶', BLUE_FULL), 'blue');
  assert.equal(classifyImported('JUVELOOK黑瓶', ''), 'black');
  assert.equal(classifyImported('', 'JUVELOOK Volume 聚乳酸'), 'black');
  assert.equal(classifyImported('其他产品', '润百颜'), null);
  assert.equal(normalizeTime('2026/10/2 9:05'), '2026-10-02 09:05:00');
});

test('预览：过滤非医生与异常结果，按产品标识去重，列出问题行', async () => {
  const file = await xlsx([
    row({ phone: '13900000001', code: udi('A0001') }),
    row({ phone: '13900000001', code: udi('A0001'), time: '2026-10-22 12:30:00' }), // 同一支再扫一次
    row({ phone: '13900000001', code: udi('A0002'), short: 'JUVELOOK黑瓶', full: 'JUVELOOK Volume' }),
    row({ phone: '18800001111', code: udi('A0003'), role: '消费者' }),
    row({ phone: '13900000001', code: udi('A0004'), result: '异常' }),
    row({ phone: '13700000000', code: udi('A0005') }), // 手机号不在系统中
    row({ phone: '13900000006', code: udi('A0006') }), // 王砚舟所在机构未授权 JUVELOOK
    row({ phone: '13900000001', code: udi('A0007'), short: '润百颜', full: '润百颜眼膜' }),
  ]);
  const { status, body } = await call('POST', '/admin/import/scans/preview', file, { raw: true });
  assert.equal(status, 200);
  assert.deepEqual(
    { ...body.summary },
    { totalRows: 8, importable: 2, blue: 1, black: 1, doctorCount: 1, skippedNotDoctor: 1, skippedAbnormal: 1, skippedDuplicate: 1, issueRows: 3 },
  );
  assert.deepEqual(body.issues.map((i) => i.row), [7, 8, 9]);
  assert.match(body.issues[0].reason, /没有这个手机号/);
  assert.match(body.issues[1].reason, /未授权 JUVELOOK/);
  assert.match(body.issues[2].reason, /无法判断/);
  // 预览不写库
  assert.equal(ctx.db.prepare(`SELECT COUNT(*) AS n FROM scans`).get().n, 0);
});

test('确认导入：支数累加，前台同步；重复导入同一文件不再计数', async () => {
  const file = await xlsx([
    row({ phone: '13900000001', code: udi('B0001') }),
    row({ phone: '13900000001', code: udi('B0002') }),
    row({ phone: '13900000001', code: udi('B0003'), short: 'JUVELOOK黑瓶' }),
    row({ phone: '13700000000', code: udi('B0004') }),
  ]);
  let r = await call('POST', '/admin/import/scans/commit', file, { raw: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.summary.importable, 3);

  const lin = ctx.ids.doctorIds['林薇'];
  const pub = await fetch(`${ctx.base}/doctors/${lin}`).then((x) => x.json());
  assert.deepEqual(pub.counts, { blue: 430, black: 217 });
  const rec = ctx.db.prepare(`SELECT source, batch_id, created_at FROM scans WHERE code = ?`).get(udi('B0001'));
  assert.equal(rec.source, 'import');
  assert.equal(rec.created_at, '2026-10-22 11:54:41');
  assert.ok(rec.batch_id);

  r = await call('POST', '/admin/import/scans/commit', file, { raw: true });
  assert.equal(r.body.summary.importable, 0);
  assert.equal(r.body.summary.skippedDuplicate, 3);
  assert.equal((await fetch(`${ctx.base}/doctors/${lin}`).then((x) => x.json())).counts.blue, 430);

  // 补录医生手机号后重新导入同一文件，之前匹配不上的那行被计入
  ctx.db.prepare(`UPDATE doctors SET mobile = '13700000000' WHERE name = '顾清晏'`).run();
  r = await call('POST', '/admin/import/scans/commit', file, { raw: true });
  assert.equal(r.body.summary.importable, 1);
  assert.equal(r.body.summary.issueRows, 0);

  const logs = await call('GET', '/admin/audit');
  assert.ok(logs.body.items.some((l) => l.entity === 'scans'));
  const list = await call('GET', '/admin/scans?source=import');
  assert.equal(list.body.total, 4);
});

test('Excel 日期格式的验证时间也能识别', async () => {
  const r0 = row({ phone: '13900000001', code: udi('C0001') });
  r0[16] = new Date(Date.UTC(2026, 9, 21, 15, 3, 9));
  const { body } = await call('POST', '/admin/import/scans/commit', await xlsx([r0]), { raw: true });
  assert.equal(body.summary.importable, 1);
  assert.equal(ctx.db.prepare('SELECT created_at FROM scans WHERE code = ?').get(udi('C0001')).created_at, '2026-10-21 15:03:09');
});

test('缺少必需列、上传错误文件时给出明确提示', async () => {
  let r = await call('POST', '/admin/import/scans/preview', await xlsx([], HEAD.filter((h) => h !== '验证时间')), { raw: true });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /缺少列：验证时间/);
  r = await call('POST', '/admin/import/scans/preview', await xlsx([['a', 'b']], ['姓名', '机构']), { raw: true });
  assert.match(r.body.error, /没有找到扫码数据/);
});

test('医生端默认关闭', async () => {
  const c = await startServer({ portalEnabled: false });
  assert.equal((await fetch(`${c.base}/portal/me`)).status, 404);
  assert.deepEqual(await fetch(`${c.base}/features`).then((x) => x.json()), { portal: false });
  c.close();
});
