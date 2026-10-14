// 运营后台 API：/api/admin/*（除登录外均需后台会话）
import express from 'express';
import { verifyPassword, hashPassword, createLoginThrottle } from './auth.js';
import { createModel, validateOrg, validateDoctor, ConflictError } from './model.js';
import { buildTemplate, parseWorkbook, planImport, applyImport } from './importer.js';

const PAGE_MAX = 100;
const pageArgs = (q) => {
  const size = Math.min(PAGE_MAX, Math.max(1, Number(q.size) || 20));
  const page = Math.max(1, Number(q.page) || 1);
  return { size, page, offset: (page - 1) * size };
};
const like = (s) => `%${String(s).trim().replace(/[\\%_]/g, (c) => '\\' + c)}%`;
const qstr = (v) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

export function createAdminRouter(db, sessions) {
  const r = express.Router();
  const model = createModel(db);
  const throttle = createLoginThrottle();

  const stmt = {
    adminByName: db.prepare('SELECT * FROM admins WHERE username = ?'),
    admin: db.prepare('SELECT * FROM admins WHERE id = ?'),
    touchLogin: db.prepare(`UPDATE admins SET last_login_at = datetime('now','localtime') WHERE id = ?`),
    setPass: db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?'),
    audit: db.prepare('INSERT INTO audit_logs (admin_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)'),
  };
  const audit = (req, action, entity, id, detail) =>
    stmt.audit.run(req.admin.id, action, entity, id ?? null, detail ? JSON.stringify(detail) : null);

  /* ---------- 登录 ---------- */
  r.post('/login', (req, res) => {
    const username = qstr(req.body?.username);
    const password = String(req.body?.password || '');
    const key = `${username}|${req.ip}`;
    if (throttle.blocked(key)) return res.status(429).json({ error: '登录失败次数过多，请 15 分钟后再试' });
    const a = username && stmt.adminByName.get(username);
    if (!a || !verifyPassword(password, a.pass_hash)) {
      throttle.fail(key);
      return res.status(401).json({ error: '账号或密码错误' });
    }
    throttle.reset(key);
    stmt.touchLogin.run(a.id);
    sessions.start(res, 'admin', a.id);
    res.json({ id: a.id, username: a.username, name: a.name });
  });

  r.post('/logout', (req, res) => {
    sessions.end(req, res, 'admin');
    res.json({ ok: true });
  });

  r.use((req, res, next) => {
    const id = sessions.lookup(req, 'admin');
    const a = id && stmt.admin.get(id);
    if (!a) return res.status(401).json({ error: '请先登录' });
    req.admin = a;
    next();
  });

  r.get('/me', (req, res) => {
    const { id, username, name, last_login_at } = req.admin;
    res.json({ id, username, name, lastLoginAt: last_login_at });
  });

  r.post('/password', (req, res) => {
    const { oldPassword = '', newPassword = '' } = req.body || {};
    if (!verifyPassword(String(oldPassword), req.admin.pass_hash)) return res.status(400).json({ error: '原密码不正确' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: '新密码至少 8 位' });
    stmt.setPass.run(hashPassword(String(newPassword)), req.admin.id);
    sessions.revokeAll('admin', req.admin.id);
    sessions.start(res, 'admin', req.admin.id);
    audit(req, 'password', 'admin', req.admin.id);
    res.json({ ok: true });
  });

  /* ---------- 概览 ---------- */
  const statsQ = {
    totals: db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM orgs WHERE status = 'active') AS orgs,
         (SELECT COUNT(*) FROM doctors WHERE status = 'active') AS doctors,
         (SELECT COALESCE(SUM(blue_count),0) FROM doctors WHERE status = 'active') AS blue,
         (SELECT COALESCE(SUM(black_count),0) FROM doctors WHERE status = 'active') AS black,
         (SELECT COUNT(*) FROM scans WHERE created_at >= date('now','localtime')) AS scans_today,
         (SELECT COUNT(*) FROM scans WHERE created_at >= date('now','localtime','-6 days')) AS scans_7d,
         (SELECT COUNT(*) FROM scans WHERE position_flag = '1') AS diverted`,
    ),
    daily: db.prepare(
      `SELECT substr(created_at, 1, 10) AS day, kind, COUNT(*) AS n FROM scans
       WHERE created_at >= date('now','localtime','-13 days') GROUP BY day, kind ORDER BY day`,
    ),
    topDoctors: db.prepare(
      `SELECT d.id, d.name, o.name AS org_name, COUNT(*) AS n FROM scans s
       JOIN doctors d ON d.id = s.doctor_id JOIN orgs o ON o.id = d.org_id
       WHERE s.created_at >= date('now','localtime','-29 days') GROUP BY d.id ORDER BY n DESC LIMIT 5`,
    ),
  };
  r.get('/stats', (req, res) => {
    res.json({ totals: statsQ.totals.get(), daily: statsQ.daily.all(), topDoctors: statsQ.topDoctors.all() });
  });

  /* ---------- 机构 ---------- */
  r.get('/orgs/options', (req, res) => {
    res.json(db.prepare(`SELECT id, name, city, auth_blue, auth_black, status FROM orgs ORDER BY city, name`).all());
  });

  r.get('/orgs', (req, res) => {
    const { size, page, offset } = pageArgs(req.query);
    const where = ['1 = 1'];
    const p = {};
    if (qstr(req.query.q)) {
      where.push(`(o.name LIKE :q ESCAPE '\\' OR o.code LIKE :q ESCAPE '\\' OR o.address LIKE :q ESCAPE '\\')`);
      p.q = like(req.query.q);
    }
    if (qstr(req.query.city)) { where.push('o.city = :city'); p.city = qstr(req.query.city); }
    if (['active', 'revoked'].includes(req.query.status)) { where.push('o.status = :status'); p.status = req.query.status; }
    const w = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) AS n FROM orgs o WHERE ${w}`).get(p).n;
    const items = db.prepare(
      `SELECT o.*,
         (SELECT COUNT(*) FROM doctors d WHERE d.org_id = o.id) AS doctor_count,
         (SELECT COALESCE(SUM(blue_count),0) FROM doctors d WHERE d.org_id = o.id) AS blue,
         (SELECT COALESCE(SUM(black_count),0) FROM doctors d WHERE d.org_id = o.id) AS black
       FROM orgs o WHERE ${w} ORDER BY o.city, o.name LIMIT ${size} OFFSET ${offset}`,
    ).all(p);
    const cities = db.prepare(`SELECT DISTINCT city FROM orgs WHERE city <> '' ORDER BY city`).all().map((x) => x.city);
    res.json({ total, page, size, items, cities });
  });

  const sendErrors = (res, errors) => res.status(400).json({ error: Object.values(errors)[0], fields: errors });
  const handleConflict = (res, err) => {
    if (err instanceof ConflictError) return res.status(409).json({ error: err.message, fields: { [err.field]: err.message } });
    throw err;
  };

  r.post('/orgs', (req, res) => {
    const { value, errors } = validateOrg(req.body || {});
    if (Object.keys(errors).length) return sendErrors(res, errors);
    try {
      const o = model.createOrg(value);
      audit(req, 'create', 'org', o.id, { name: o.name });
      res.status(201).json(o);
    } catch (err) {
      handleConflict(res, err);
    }
  });

  r.put('/orgs/:id', (req, res) => {
    const { value, errors } = validateOrg(req.body || {});
    if (Object.keys(errors).length) return sendErrors(res, errors);
    try {
      const o = model.updateOrg(req.params.id, value);
      if (!o) return res.status(404).json({ error: '机构不存在' });
      audit(req, 'update', 'org', o.id, value);
      res.json(o);
    } catch (err) {
      handleConflict(res, err);
    }
  });

  r.delete('/orgs/:id', (req, res) => {
    const o = db.prepare('SELECT * FROM orgs WHERE id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: '机构不存在' });
    const n = db.prepare('SELECT COUNT(*) AS n FROM doctors WHERE org_id = ?').get(o.id).n;
    if (n) return res.status(409).json({ error: `「${o.name}」下还有 ${n} 位医生，请先删除或转移医生；如需停止展示，可将机构设为「已撤销」` });
    db.prepare('DELETE FROM orgs WHERE id = ?').run(o.id);
    audit(req, 'delete', 'org', o.id, { name: o.name });
    res.json({ ok: true });
  });

  /* ---------- 医生 ---------- */
  r.get('/doctors', (req, res) => {
    const { size, page, offset } = pageArgs(req.query);
    const where = ['1 = 1'];
    const p = {};
    if (qstr(req.query.q)) {
      where.push(`(d.name LIKE :q ESCAPE '\\' OR d.code LIKE :q ESCAPE '\\' OR d.mobile LIKE :q ESCAPE '\\')`);
      p.q = like(req.query.q);
    }
    if (qstr(req.query.orgId)) { where.push('d.org_id = :org'); p.org = qstr(req.query.orgId); }
    if (qstr(req.query.city)) { where.push('o.city = :city'); p.city = qstr(req.query.city); }
    if (['active', 'revoked'].includes(req.query.status)) { where.push('d.status = :status'); p.status = req.query.status; }
    const w = where.join(' AND ');
    const from = 'FROM doctors d JOIN orgs o ON o.id = d.org_id';
    const total = db.prepare(`SELECT COUNT(*) AS n ${from} WHERE ${w}`).get(p).n;
    const items = db.prepare(
      `SELECT d.*, o.name AS org_name, o.city, o.auth_blue, o.auth_black,
         (SELECT COUNT(*) FROM scans s WHERE s.doctor_id = d.id) AS scan_count
       ${from} WHERE ${w} ORDER BY o.city, o.name, d.name LIMIT ${size} OFFSET ${offset}`,
    ).all(p);
    res.json({ total, page, size, items });
  });

  r.post('/doctors', (req, res) => {
    const { value, errors } = validateDoctor(req.body || {});
    if (Object.keys(errors).length) return sendErrors(res, errors);
    try {
      const d = model.createDoctor(value);
      audit(req, 'create', 'doctor', d.id, { name: d.name });
      res.status(201).json(d);
    } catch (err) {
      handleConflict(res, err);
    }
  });

  r.put('/doctors/:id', (req, res) => {
    const { value, errors } = validateDoctor(req.body || {});
    if (Object.keys(errors).length) return sendErrors(res, errors);
    try {
      const before = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
      const d = model.updateDoctor(req.params.id, value);
      if (!d) return res.status(404).json({ error: '医生不存在' });
      // 支数被人工调整时记录前后值，便于对账
      const detail = { ...value };
      if (before.blue_count !== d.blue_count || before.black_count !== d.black_count) {
        detail.countsBefore = { blue: before.blue_count, black: before.black_count };
      }
      // 撤销认证后踢出医生端登录
      if (d.status !== 'active') sessions.revokeAll('doctor', d.id);
      audit(req, 'update', 'doctor', d.id, detail);
      res.json(d);
    } catch (err) {
      handleConflict(res, err);
    }
  });

  r.delete('/doctors/:id', (req, res) => {
    const d = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
    if (!d) return res.status(404).json({ error: '医生不存在' });
    const n = db.prepare('SELECT COUNT(*) AS n FROM scans WHERE doctor_id = ?').get(d.id).n;
    if (n) return res.status(409).json({ error: `「${d.name}」已有 ${n} 条核销记录，不能删除；如需停止展示，请将认证状态设为「已撤销」` });
    db.prepare('DELETE FROM doctors WHERE id = ?').run(d.id);
    sessions.revokeAll('doctor', d.id);
    audit(req, 'delete', 'doctor', d.id, { name: d.name });
    res.json({ ok: true });
  });

  /* ---------- 核销记录 ---------- */
  r.get('/scans', (req, res) => {
    const { size, page, offset } = pageArgs(req.query);
    const where = ['1 = 1'];
    const p = {};
    if (qstr(req.query.q)) {
      where.push(`(s.code LIKE :q ESCAPE '\\' OR d.name LIKE :q ESCAPE '\\' OR o.name LIKE :q ESCAPE '\\')`);
      p.q = like(req.query.q);
    }
    if (['blue', 'black'].includes(req.query.kind)) { where.push('s.kind = :kind'); p.kind = req.query.kind; }
    if (req.query.diverted === '1') where.push(`s.position_flag = '1'`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { where.push('s.created_at >= :from'); p.from = req.query.from; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { where.push(`s.created_at < date(:to, '+1 day')`); p.to = req.query.to; }
    const w = where.join(' AND ');
    const from = 'FROM scans s JOIN doctors d ON d.id = s.doctor_id JOIN orgs o ON o.id = s.org_id';
    const total = db.prepare(`SELECT COUNT(*) AS n ${from} WHERE ${w}`).get(p).n;
    const items = db.prepare(
      `SELECT s.id, s.code, s.kind, s.product_name, s.batch_number, s.position_flag, s.created_at,
         d.id AS doctor_id, d.name AS doctor_name, o.name AS org_name, o.city
       ${from} WHERE ${w} ORDER BY s.created_at DESC LIMIT ${size} OFFSET ${offset}`,
    ).all(p);
    res.json({ total, page, size, items });
  });

  /* ---------- 操作日志 ---------- */
  r.get('/audit', (req, res) => {
    const { size, page, offset } = pageArgs(req.query);
    const total = db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n;
    const items = db.prepare(
      `SELECT l.*, a.username FROM audit_logs l LEFT JOIN admins a ON a.id = l.admin_id
       ORDER BY l.id DESC LIMIT ${size} OFFSET ${offset}`,
    ).all();
    res.json({ total, page, size, items });
  });

  /* ---------- Excel 导入 ---------- */
  r.get('/import/template', async (req, res) => {
    const buf = await buildTemplate();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('juvelook数据导入模板.xlsx')}`);
    res.send(buf);
  });

  const xlsxBody = express.raw({ type: () => true, limit: '5mb' });
  const readPlan = async (req) => planImport(db, await parseWorkbook(req.body));
  const strip = (plan) => ({
    summary: plan.summary,
    orgs: plan.orgs.map(({ value, id, ...x }) => x),
    doctors: plan.doctors.map(({ value, id, ...x }) => x),
  });

  r.post('/import/preview', xlsxBody, async (req, res) => {
    try {
      res.json(strip(await readPlan(req)));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 确认导入时重新上传同一文件并重新校验，避免预览后数据变化导致不一致
  r.post('/import/commit', xlsxBody, async (req, res) => {
    let plan;
    try {
      plan = await readPlan(req);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    if (plan.summary.errorRows) return res.status(400).json({ error: '存在校验错误的行，请修正后重新上传', ...strip(plan) });
    try {
      const summary = applyImport(db, model, plan);
      audit(req, 'import', 'excel', null, summary);
      res.json({ ok: true, summary });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return r;
}
