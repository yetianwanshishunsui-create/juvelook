import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDemo } from './fixtures.js';

let server, base, db, ids;

before(async () => {
  db = openDb(':memory:');
  ids = seedDemo(db);
  server = createApp(db, { rateLimitMax: 1000 }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

test('meta: 统计与城市列表', async () => {
  const { body } = await get('/meta');
  assert.equal(body.doctorCount, 8);
  assert.equal(body.orgCount, 5);
  assert.deepEqual(body.cities.slice(0, 3), ['上海', '北京', '广州']);
});

test('医生查询：必须带关键词或城市', async () => {
  const { status } = await get('/doctors');
  assert.equal(status, 400);
});

test('医生查询：姓名模糊匹配', async () => {
  const { body } = await get('/doctors?q=' + encodeURIComponent('砚'));
  assert.deepEqual(body.items.map((d) => d.name).sort(), ['沈砚清', '王砚舟'].sort());
});

test('医生查询：按城市筛选并与关键词组合', async () => {
  let { body } = await get('/doctors?city=' + encodeURIComponent('上海'));
  assert.equal(body.items.length, 2);
  ({ body } = await get('/doctors?city=' + encodeURIComponent('上海') + '&q=' + encodeURIComponent('陈')));
  assert.equal(body.items.length, 0);
});

test('医生查询：按认证编号精确查找', async () => {
  const { body } = await get('/doctors?q=JVL-D0001');
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].name, '林薇');
});

test('医生查询：通配符被转义', async () => {
  const { body } = await get('/doctors?q=%25');
  assert.equal(body.items.length, 0);
});

test('医生详情：未授权品类支数为 null', async () => {
  const { body } = await get('/doctors/' + ids.doctorIds['王砚舟']);
  assert.equal(body.org.name, '昀熙医疗美容门诊部');
  assert.deepEqual(body.counts, { blue: null, black: 274 });
});

test('医生详情：不存在返回 404', async () => {
  const { status } = await get('/doctors/nope');
  assert.equal(status, 404);
});

test('机构查询与详情：汇总名下医生支数', async () => {
  const { body: list } = await get('/orgs?q=' + encodeURIComponent('天河'));
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].doctorCount, 2);
  const { body } = await get('/orgs/' + list.items[0].id);
  assert.deepEqual(body.totals, { blue: 210, black: 387 });
  assert.equal(body.doctors.length, 2);
});

test('已撤销认证的医生不再对外展示', async () => {
  db.prepare("UPDATE doctors SET status = 'revoked' WHERE id = ?").run(ids.doctorIds['苏牧云']);
  const { status } = await get('/doctors/' + ids.doctorIds['苏牧云']);
  assert.equal(status, 404);
  const { body } = await get('/orgs/' + ids.orgIds.o5);
  assert.equal(body.doctors.length, 1);
  db.prepare("UPDATE doctors SET status = 'active' WHERE id = ?").run(ids.doctorIds['苏牧云']);
});
