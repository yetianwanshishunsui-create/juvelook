// 在线演示版的浏览器内模拟后端：接口与 server/ 保持一致，数据存于本机浏览器。
// 复用服务端的字段校验、模拟验真与虚拟数据生成，规则与正式版相同。
import { generateFakeData } from '../../../server/src/fake-data.js';
import { validateOrg, validateDoctor } from '../../../server/src/validate.js';
import { createVerifier, classifyProduct, normalizeCode } from '../../../server/src/verify.js';
import { newId } from '../../../server/src/ids.js';

const KEY = 'jvl-demo-v3';
// 医生端是否开放：与服务端 PORTAL_ENABLED 对应，测试版默认关闭（医生扫码走小程序）
const PORTAL = !!import.meta.env.VITE_PORTAL;
export const DEMO_ADMIN = { username: 'admin', password: 'juvelook-demo' };
const verify = createVerifier({ mode: 'mock' });
const PRODUCT = { blue: 'JUVELOOK', black: 'JUVELOOK Volume' };

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const dayStr = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return fmt(d).slice(0, 10);
};

let memory = null;
function fresh() {
  const data = generateFakeData({ now: new Date() });
  return { ...data, audit: [], adminPass: DEMO_ADMIN.password, adminSession: false, doctorSession: null, auditSeq: 0 };
}
function load() {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(KEY));
  } catch {
    memory = null;
  }
  if (!memory?.orgs) {
    memory = fresh();
    save();
  }
  return memory;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // 无痕模式等情况下仅保存在内存
  }
}
export function resetDemo() {
  memory = fresh();
  save();
}

class HttpError extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}
const fail = (status, error, extra = {}) => {
  throw new HttpError(status, { error, ...extra });
};

/* ---------- 公共查询 ---------- */
const orgById = (s, id) => s.orgs.find((o) => o.id === id);
const productsOf = (o) => [o.auth_blue ? 'blue' : null, o.auth_black ? 'black' : null].filter(Boolean);
const countsOf = (d, products) => ({
  blue: products.includes('blue') ? d.blue_count : null,
  black: products.includes('black') ? d.black_count : null,
});
const activeDoc = (s, d) => d.status === 'active' && orgById(s, d.org_id)?.status === 'active';
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const page50 = (rows) => ({ items: rows.slice(0, 50), truncated: rows.length > 50 });
const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, 40) : '');

const routes = [];
const on = (method, pattern, fn) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, re, keys, fn });
};

on('GET', '/meta', (s) => {
  const docs = s.doctors.filter((d) => activeDoc(s, d));
  const count = {};
  docs.forEach((d) => {
    const c = orgById(s, d.org_id).city;
    if (c) count[c] = (count[c] || 0) + 1;
  });
  return {
    doctorCount: docs.length,
    orgCount: s.orgs.filter((o) => o.status === 'active').length,
    cities: Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1)),
    portal: PORTAL,
  };
});

on('GET', '/doctors', (s, { params }) => {
  const q = clean(params.q), city = clean(params.city);
  if (!q && !city) fail(400, '请输入医生姓名或选择城市');
  const rows = s.doctors
    .filter((d) => activeDoc(s, d))
    .filter((d) => !q || d.name.includes(q) || d.code === q)
    .filter((d) => !city || orgById(s, d.org_id).city === city)
    .sort(byName);
  const { items, truncated } = page50(rows);
  return {
    truncated,
    items: items.map((d) => {
      const o = orgById(s, d.org_id);
      return { id: d.id, code: d.code, name: d.name, city: o.city, org: { id: o.id, name: o.name }, counts: countsOf(d, productsOf(o)) };
    }),
  };
});

on('GET', '/doctors/:id', (s, { p }) => {
  const d = s.doctors.find((x) => x.id === p.id && activeDoc(s, x));
  if (!d) fail(404, '未找到该医生');
  const o = orgById(s, d.org_id);
  const products = productsOf(o);
  return {
    id: d.id, code: d.code, name: d.name, city: o.city,
    org: { id: o.id, name: o.name, city: o.city, address: o.address, products },
    counts: countsOf(d, products),
  };
});

on('GET', '/orgs', (s, { params }) => {
  const q = clean(params.q);
  if (!q) fail(400, '请输入机构名称');
  const rows = s.orgs.filter((o) => o.status === 'active' && (o.name.includes(q) || o.code === q)).sort(byName);
  const { items, truncated } = page50(rows);
  return {
    truncated,
    items: items.map((o) => ({
      id: o.id, code: o.code, name: o.name, city: o.city, address: o.address, products: productsOf(o),
      doctorCount: s.doctors.filter((d) => d.org_id === o.id && d.status === 'active').length,
    })),
  };
});

on('GET', '/orgs/:id', (s, { p }) => {
  const o = s.orgs.find((x) => x.id === p.id && x.status === 'active');
  if (!o) fail(404, '未找到该机构');
  const products = productsOf(o);
  const doctors = s.doctors
    .filter((d) => d.org_id === o.id && d.status === 'active')
    .sort(byName)
    .map((d) => ({ id: d.id, name: d.name, counts: countsOf(d, products) }));
  const sum = (k) => (products.includes(k) ? doctors.reduce((t, d) => t + d.counts[k], 0) : null);
  return { id: o.id, code: o.code, name: o.name, city: o.city, address: o.address, products, totals: { blue: sum('blue'), black: sum('black') }, doctors };
});

/* ---------- 医生端 ---------- */
on('POST', '/portal/login', (s, { body }) => {
  const code = String(body?.code || '').trim().toUpperCase();
  const mobile = String(body?.mobile || '').replace(/\D/g, '');
  const d = s.doctors.find((x) => x.code.toUpperCase() === code && x.mobile && x.mobile === mobile);
  if (!d || !activeDoc(s, d)) fail(401, '认证编号或手机号不正确，或认证已失效');
  s.doctorSession = d.id;
  return { ok: true };
});
on('POST', '/portal/logout', (s) => ((s.doctorSession = null), { ok: true }));
on('GET', '/portal/wx-config', () => ({ enabled: false }));

const currentDoctor = (s) => {
  const d = s.doctors.find((x) => x.id === s.doctorSession);
  if (!d || !activeDoc(s, d)) fail(401, '请先登录');
  return d;
};
on('GET', '/portal/me', (s) => {
  const d = currentDoctor(s);
  const o = orgById(s, d.org_id);
  return {
    id: d.id, code: d.code, name: d.name,
    org: { id: o.id, name: o.name, city: o.city, products: productsOf(o) },
    counts: { blue: o.auth_blue ? d.blue_count : null, black: o.auth_black ? d.black_count : null },
    scanTotal: s.scans.filter((x) => x.doctor_id === d.id).length,
  };
});
on('GET', '/portal/scans', (s, { params }) => {
  const d = currentDoctor(s);
  const limit = Math.min(50, Number(params.limit) || 20);
  return s.scans
    .filter((x) => x.doctor_id === d.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(({ code, kind, product_name, position_flag, created_at }) => ({ code, kind, product_name, position_flag, created_at }));
});
on('POST', '/portal/scan', async (s, { body }) => {
  const d = currentDoctor(s);
  const o = orgById(s, d.org_id);
  const code = normalizeCode(body?.code);
  if (!code) fail(400, '未识别到防伪码');
  const used = () => {
    const prev = s.scans.find((x) => x.code === code);
    if (prev) fail(409, `该码已于 ${prev.created_at} 由${prev.doctor_id === d.id ? '您' : '其他医生'}核销，不能重复计数`);
  };
  used();
  const v = await verify({ code });
  if (!v.ok) fail(422, `验真未通过：${v.reason}`);
  const kind = classifyProduct(v.productName);
  if (!kind) fail(422, `无法识别产品品类：${v.productName || '未知产品'}`);
  if (v.expirationDate && Date.parse(v.expirationDate.replace(' ', 'T')) < Date.now()) {
    fail(422, `该产品已过有效期（${v.expirationDate.slice(0, 10)}），不予核销`);
  }
  if (!(kind === 'blue' ? o.auth_blue : o.auth_black)) fail(403, `您所在机构未获 ${PRODUCT[kind]} 授权，不能核销`);
  used();
  s.scans.push({
    id: newId(), code, doctor_id: d.id, org_id: o.id, kind, product_name: v.productName,
    batch_number: v.batchNumber, position_flag: v.positionFlag, created_at: fmt(new Date()),
  });
  d[kind === 'blue' ? 'blue_count' : 'black_count']++;
  return {
    kind, product: PRODUCT[kind], productName: v.productName, batchNumber: v.batchNumber, code,
    diverted: v.positionFlag === '1', counts: { blue: d.blue_count, black: d.black_count },
  };
});

/* ---------- 运营后台 ---------- */
const audit = (s, action, entity, entityId, detail) =>
  s.audit.push({
    id: ++s.auditSeq, username: DEMO_ADMIN.username, action, entity, entity_id: entityId,
    detail: detail ? JSON.stringify(detail) : null, created_at: fmt(new Date()),
  });
const requireAdmin = (s) => !s.adminSession && fail(401, '请先登录');
const paginate = (rows, params) => {
  const size = Math.min(100, Math.max(1, Number(params.size) || 20));
  const page = Math.max(1, Number(params.page) || 1);
  return { total: rows.length, page, size, items: rows.slice((page - 1) * size, page * size) };
};
const kw = (params) => (typeof params.q === 'string' ? params.q.trim() : '');
const hasErr = (errors) => Object.keys(errors).length && fail(400, Object.values(errors)[0], { fields: errors });
const nextCode = (s, prefix) => {
  const n = Math.max(0, ...[...s.orgs, ...s.doctors].map((x) => x.code).filter((c) => c?.startsWith(prefix)).map((c) => Number(c.slice(prefix.length)) || 0));
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
};
const conflict = (field, msg) => fail(409, msg, { fields: { [field]: msg } });

on('POST', '/admin/login', (s, { body }) => {
  if (body?.username !== DEMO_ADMIN.username || body?.password !== s.adminPass) fail(401, '账号或密码错误');
  s.adminSession = true;
  return { id: 'demo', username: DEMO_ADMIN.username, name: '管理员' };
});
on('POST', '/admin/logout', (s) => ((s.adminSession = false), { ok: true }));
on('GET', '/admin/me', (s) => (requireAdmin(s), { id: 'demo', username: DEMO_ADMIN.username, name: '管理员', lastLoginAt: null }));
on('POST', '/admin/password', (s, { body }) => {
  requireAdmin(s);
  if (body?.oldPassword !== s.adminPass) fail(400, '原密码不正确');
  if (String(body?.newPassword || '').length < 8) fail(400, '新密码至少 8 位');
  s.adminPass = body.newPassword;
  audit(s, 'password', 'admin', 'demo');
  return { ok: true };
});

on('GET', '/admin/stats', (s) => {
  requireAdmin(s);
  const act = s.doctors.filter((d) => d.status === 'active');
  const today = dayStr(0), d7 = dayStr(-6), d14 = dayStr(-13), d30 = dayStr(-29);
  const daily = {};
  s.scans.filter((x) => x.created_at >= d14).forEach((x) => {
    const k = `${x.created_at.slice(0, 10)}|${x.kind}`;
    daily[k] = (daily[k] || 0) + 1;
  });
  const top = {};
  s.scans.filter((x) => x.created_at >= d30).forEach((x) => (top[x.doctor_id] = (top[x.doctor_id] || 0) + 1));
  return {
    totals: {
      orgs: s.orgs.filter((o) => o.status === 'active').length,
      doctors: act.length,
      blue: act.reduce((t, d) => t + d.blue_count, 0),
      black: act.reduce((t, d) => t + d.black_count, 0),
      scans_today: s.scans.filter((x) => x.created_at >= today).length,
      scans_7d: s.scans.filter((x) => x.created_at >= d7).length,
      diverted: s.scans.filter((x) => x.position_flag === '1').length,
    },
    daily: Object.entries(daily).map(([k, n]) => ({ day: k.split('|')[0], kind: k.split('|')[1], n })),
    topDoctors: Object.entries(top)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => {
        const d = s.doctors.find((x) => x.id === id);
        return { id, name: d.name, org_name: orgById(s, d.org_id).name, n };
      }),
  };
});

on('GET', '/admin/orgs/options', (s) => {
  requireAdmin(s);
  return [...s.orgs]
    .sort((a, b) => (a.city + a.name).localeCompare(b.city + b.name))
    .map(({ id, name, city, auth_blue, auth_black, status }) => ({ id, name, city, auth_blue, auth_black, status }));
});
on('GET', '/admin/orgs', (s, { params }) => {
  requireAdmin(s);
  const q = kw(params);
  const rows = s.orgs
    .filter((o) => !q || o.name.includes(q) || o.code?.includes(q) || o.address.includes(q))
    .filter((o) => !params.city || o.city === params.city)
    .filter((o) => !params.status || o.status === params.status)
    .sort((a, b) => (a.city + a.name).localeCompare(b.city + b.name))
    .map((o) => {
      const docs = s.doctors.filter((d) => d.org_id === o.id);
      return { ...o, doctor_count: docs.length, blue: docs.reduce((t, d) => t + d.blue_count, 0), black: docs.reduce((t, d) => t + d.black_count, 0) };
    });
  return { ...paginate(rows, params), cities: [...new Set(s.orgs.map((o) => o.city).filter(Boolean))].sort() };
});
const saveOrg = (s, id, body) => {
  requireAdmin(s);
  const { value, errors } = validateOrg(body || {});
  hasErr(errors);
  const cur = id && s.orgs.find((o) => o.id === id);
  if (id && !cur) fail(404, '机构不存在');
  const byName = s.orgs.find((o) => o.name === value.name);
  if (byName && byName.id !== id) conflict('name', `机构「${value.name}」已存在`);
  const byCode = value.code && s.orgs.find((o) => o.code === value.code);
  if (byCode && byCode.id !== id) conflict('code', `编号 ${value.code} 已被「${byCode.name}」使用`);
  if (cur) {
    Object.assign(cur, value, { code: value.code || cur.code });
    audit(s, 'update', 'org', cur.id, value);
    return cur;
  }
  const o = { ...value, id: newId(), code: value.code || nextCode(s, 'JVL-O') };
  s.orgs.push(o);
  audit(s, 'create', 'org', o.id, { name: o.name });
  return o;
};
on('POST', '/admin/orgs', (s, { body }) => saveOrg(s, null, body));
on('PUT', '/admin/orgs/:id', (s, { p, body }) => saveOrg(s, p.id, body));
on('DELETE', '/admin/orgs/:id', (s, { p }) => {
  requireAdmin(s);
  const o = orgById(s, p.id);
  if (!o) fail(404, '机构不存在');
  const n = s.doctors.filter((d) => d.org_id === o.id).length;
  if (n) fail(409, `「${o.name}」下还有 ${n} 位医生，请先删除或转移医生；如需停止展示，可将机构设为「已撤销」`);
  s.orgs = s.orgs.filter((x) => x.id !== o.id);
  audit(s, 'delete', 'org', o.id, { name: o.name });
  return { ok: true };
});

on('GET', '/admin/doctors', (s, { params }) => {
  requireAdmin(s);
  const q = kw(params);
  const rows = s.doctors
    .map((d) => ({ d, o: orgById(s, d.org_id) }))
    .filter(({ d }) => !q || d.name.includes(q) || d.code?.includes(q) || d.mobile.includes(q))
    .filter(({ d }) => !params.orgId || d.org_id === params.orgId)
    .filter(({ o }) => !params.city || o.city === params.city)
    .filter(({ d }) => !params.status || d.status === params.status)
    .sort((a, b) => (a.o.city + a.o.name + a.d.name).localeCompare(b.o.city + b.o.name + b.d.name))
    .map(({ d, o }) => ({
      ...d, org_name: o.name, city: o.city, auth_blue: o.auth_blue, auth_black: o.auth_black,
      scan_count: s.scans.filter((x) => x.doctor_id === d.id).length,
    }));
  return paginate(rows, params);
});
const saveDoctor = (s, id, body) => {
  requireAdmin(s);
  const { value, errors } = validateDoctor(body || {});
  hasErr(errors);
  const cur = id && s.doctors.find((d) => d.id === id);
  if (id && !cur) fail(404, '医生不存在');
  if (!orgById(s, value.org_id)) conflict('org_id', '所属机构不存在');
  const byCode = value.code && s.doctors.find((d) => d.code === value.code);
  if (byCode && byCode.id !== id) conflict('code', `编号 ${value.code} 已被医生「${byCode.name}」使用`);
  if (cur) {
    const detail = { ...value };
    if (cur.blue_count !== value.blue_count || cur.black_count !== value.black_count) {
      detail.countsBefore = { blue: cur.blue_count, black: cur.black_count };
    }
    Object.assign(cur, value, { code: value.code || cur.code });
    if (cur.status !== 'active' && s.doctorSession === cur.id) s.doctorSession = null;
    audit(s, 'update', 'doctor', cur.id, detail);
    return cur;
  }
  const d = { ...value, id: newId(), code: value.code || nextCode(s, 'JVL-D') };
  s.doctors.push(d);
  audit(s, 'create', 'doctor', d.id, { name: d.name });
  return d;
};
on('POST', '/admin/doctors', (s, { body }) => saveDoctor(s, null, body));
on('PUT', '/admin/doctors/:id', (s, { p, body }) => saveDoctor(s, p.id, body));
on('DELETE', '/admin/doctors/:id', (s, { p }) => {
  requireAdmin(s);
  const d = s.doctors.find((x) => x.id === p.id);
  if (!d) fail(404, '医生不存在');
  const n = s.scans.filter((x) => x.doctor_id === d.id).length;
  if (n) fail(409, `「${d.name}」已有 ${n} 条核销记录，不能删除；如需停止展示，请将认证状态设为「已撤销」`);
  s.doctors = s.doctors.filter((x) => x.id !== d.id);
  audit(s, 'delete', 'doctor', d.id, { name: d.name });
  return { ok: true };
});

on('GET', '/admin/scans', (s, { params }) => {
  requireAdmin(s);
  const q = kw(params);
  const rows = s.scans
    .map((x) => ({ x, d: s.doctors.find((d) => d.id === x.doctor_id), o: orgById(s, x.org_id) }))
    .filter(({ x, d, o }) => !q || x.code.includes(q) || d?.name.includes(q) || o?.name.includes(q))
    .filter(({ x }) => !params.kind || x.kind === params.kind)
    .filter(({ x }) => params.diverted !== '1' || x.position_flag === '1')
    .filter(({ x }) => !params.source || (x.source || 'h5') === params.source)
    .filter(({ x }) => !params.from || x.created_at >= params.from)
    .filter(({ x }) => !params.to || x.created_at.slice(0, 10) <= params.to)
    .sort((a, b) => b.x.created_at.localeCompare(a.x.created_at))
    .map(({ x, d, o }) => ({ ...x, doctor_name: d?.name || '—', org_name: o?.name || '—', city: o?.city || '' }));
  return paginate(rows, params);
});
on('GET', '/admin/audit', (s, { params }) => (requireAdmin(s), paginate([...s.audit].reverse(), params)));
const scanLookups = (s) => ({
  doctorByPhone: (phone) => {
    const rows = s.doctors.filter((d) => d.mobile === phone);
    if (rows.length > 1) return 'ambiguous';
    const d = rows[0];
    if (!d) return null;
    const o = orgById(s, d.org_id);
    return { id: d.id, name: d.name, code: d.code, org_name: o.name, auth_blue: o.auth_blue, auth_black: o.auth_black };
  },
  existingScan: (code) => s.scans.find((x) => x.code === code) || null,
});
const readScans = async (body) => {
  const { parseScanWorkbook } = await import('../../../server/src/scan-import.js');
  return parseScanWorkbook(body instanceof Blob ? await body.arrayBuffer() : body);
};
const scanView = (p) => ({ summary: p.summary, doctors: p.doctors, issues: p.issues.slice(0, 500), issuesTruncated: p.issues.length > 500 });
on('POST', '/admin/import/scans/preview', async (s, { body }) => {
  requireAdmin(s);
  const { planScanImport } = await import('../../../server/src/scan-import.js');
  try {
    return scanView(planScanImport(await readScans(body), scanLookups(s)));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    fail(400, err.message);
  }
});
on('POST', '/admin/import/scans/commit', async (s, { body }) => {
  requireAdmin(s);
  const { planScanImport } = await import('../../../server/src/scan-import.js');
  let p;
  try {
    p = planScanImport(await readScans(body), scanLookups(s));
  } catch (err) {
    fail(400, err.message);
  }
  const batchId = newId();
  for (const it of p.items) {
    const d = s.doctors.find((x) => x.id === it.doctorId);
    s.scans.push({
      id: newId(), code: it.code, doctor_id: d.id, org_id: d.org_id, kind: it.kind, product_name: it.productName,
      batch_number: it.batchNumber, position_flag: null, created_at: it.time, source: 'import', batch_id: batchId,
    });
    d[it.kind === 'blue' ? 'blue_count' : 'black_count']++;
  }
  audit(s, 'import', 'scans', batchId, p.summary);
  return { ok: true, batchId, ...scanView(p) };
});

// 测试用扫码数据表：与小程序导出格式相同，含可导入行和几种典型问题行
export async function buildSampleScanXlsx() {
  const s = load();
  const { default: ExcelJS } = await import('exceljs');
  const head = ['用户ID', '用户姓名', '手机号', '用户身份', '获得积分', '验证结果', '渠道码', '产品名称', '品牌名称', '产品标识', '批次号', '产品名称（显示）', '生产日期', '使用期限', '公司名称', '查询次数', '验证时间'];
  const full = { blue: 'JUVELOOK聚乳酸面部填充剂[Juvelook-C（50mg/瓶）*1瓶/盒]', black: 'JUVELOOK Volume聚乳酸面部填充剂[Juvelook-V（200mg/瓶）*1瓶/盒]' };
  const short = { blue: 'JUVELOOK蓝瓶', black: 'JUVELOOK黑瓶' };
  const rand = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  const udi = () => `0118800051300185172809081 0JC26094121JC260941A${rand(6)}`.replace(' ', '');
  const now = new Date();
  const t = (minsAgo) => fmt(new Date(now.getTime() - minsAgo * 60000));
  const row = (d, kind, opts = {}) => [
    rand(19), opts.nick || d.name, opts.phone ?? d.mobile, opts.role || '医生身份', '50', opts.result || '正常', '',
    full[kind], '代理类产品', opts.code || udi(), 'JC260941', short[kind], '2026-09-09', '2028-09-08', 'null', '1', t(opts.ago ?? 60),
  ];
  const docs = s.doctors.filter((d) => activeDoc(s, d)).slice(0, 6);
  const kindsOf = (d) => productsOf(orgById(s, d.org_id));
  const rows = [];
  docs.forEach((d, i) => {
    for (let k = 0; k < 2 + (i % 3); k++) rows.push(row(d, kindsOf(d)[k % kindsOf(d).length], { ago: 30 + i * 50 + k * 7 }));
  });
  const dupCode = udi();
  rows.push(row(docs[0], kindsOf(docs[0])[0], { code: dupCode, ago: 20 }));
  rows.push(row(docs[0], kindsOf(docs[0])[0], { code: dupCode, ago: 10 })); // 同一支扫了两次
  rows.push(row(docs[1], 'blue', { role: '消费者', phone: '13800000000', ago: 15 })); // 消费者验真
  rows.push(row(docs[2], kindsOf(docs[2])[0], { phone: '13999999999', ago: 12 })); // 手机号未录入
  const unauth = s.doctors.find((d) => activeDoc(s, d) && kindsOf(d).length === 1);
  if (unauth) rows.push(row(unauth, kindsOf(unauth)[0] === 'blue' ? 'black' : 'blue', { ago: 8 })); // 未授权品类
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('扫码验真记录数据导出.xlsx');
  ws.addRow(head);
  rows.forEach((r) => ws.addRow(r));
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const noImport = (s) => {
  requireAdmin(s);
  fail(400, '在线演示版无法上传文件。Excel 导入在正式部署环境中可用：下载模板 → 填写 → 上传预览 → 确认导入。');
};
on('POST', '/admin/import/preview', noImport);
on('POST', '/admin/import/commit', noImport);

/* ---------- 入口 ---------- */
export async function mockRequest(method, path, { params = {}, body } = {}) {
  await new Promise((r) => setTimeout(r, 120)); // 模拟网络延迟
  const s = load();
  if (!PORTAL && path.startsWith('/portal/')) fail(404, '接口不存在');
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const p = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const out = await r.fn(s, { p, params, body });
    save();
    return JSON.parse(JSON.stringify(out));
  }
  fail(404, '接口不存在');
}
