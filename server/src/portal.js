// 医生端 API：/api/portal/*
// 登录：认证编号 + 手机号（与后台录入一致）。后续接入微信网页授权后，首次登录绑定 openid 即可免密进入。
import express from 'express';
import { createLoginThrottle } from './auth.js';
import { ScanError } from './scan.js';

export function createPortalRouter(db, sessions, { redeem, wechat }) {
  const r = express.Router();
  const throttle = createLoginThrottle();

  const stmt = {
    byLogin: db.prepare(`SELECT * FROM doctors WHERE UPPER(code) = ? AND mobile = ? AND mobile <> ''`),
    me: db.prepare(
      `SELECT d.id, d.code, d.name, d.blue_count, d.black_count, d.status,
         o.id AS org_id, o.name AS org_name, o.city, o.auth_blue, o.auth_black, o.status AS org_status
       FROM doctors d JOIN orgs o ON o.id = d.org_id WHERE d.id = ?`,
    ),
    scans: db.prepare(
      `SELECT code, kind, product_name, position_flag, created_at FROM scans WHERE doctor_id = ? ORDER BY created_at DESC LIMIT ?`,
    ),
    scanTotal: db.prepare('SELECT COUNT(*) AS n FROM scans WHERE doctor_id = ?'),
  };
  const usable = (d) => d && d.status === 'active' && d.org_status === 'active';

  r.post('/login', (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase().slice(0, 32);
    const mobile = String(req.body?.mobile || '').replace(/\D/g, '').slice(0, 11);
    const key = `${code}|${req.ip}`;
    if (throttle.blocked(key)) return res.status(429).json({ error: '尝试次数过多，请 15 分钟后再试' });
    const d = code && mobile && stmt.byLogin.get(code, mobile);
    if (!d || !usable(stmt.me.get(d.id))) {
      throttle.fail(key);
      return res.status(401).json({ error: '认证编号或手机号不正确，或认证已失效' });
    }
    throttle.reset(key);
    sessions.start(res, 'doctor', d.id);
    res.json({ ok: true });
  });

  r.post('/logout', (req, res) => {
    sessions.end(req, res, 'doctor');
    res.json({ ok: true });
  });

  // JS-SDK 配置不需要登录（登录页也可能用到），未配置公众号时返回 enabled: false
  r.get('/wx-config', async (req, res) => {
    if (!wechat) return res.json({ enabled: false });
    const url = String(req.query.url || '');
    if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: '缺少页面地址' });
    try {
      res.json({ enabled: true, ...(await wechat.jsapiConfig(url)) });
    } catch (err) {
      console.error(err);
      res.json({ enabled: false, error: '微信配置获取失败' });
    }
  });

  r.use((req, res, next) => {
    const id = sessions.lookup(req, 'doctor');
    const d = id && stmt.me.get(id);
    if (!usable(d)) return res.status(401).json({ error: '请先登录' });
    req.doctor = d;
    next();
  });

  r.get('/me', (req, res) => {
    const d = req.doctor;
    const products = [d.auth_blue && 'blue', d.auth_black && 'black'].filter(Boolean);
    res.json({
      id: d.id,
      code: d.code,
      name: d.name,
      org: { id: d.org_id, name: d.org_name, city: d.city, products },
      counts: {
        blue: d.auth_blue ? d.blue_count : null,
        black: d.auth_black ? d.black_count : null,
      },
      scanTotal: stmt.scanTotal.get(d.id).n,
    });
  });

  r.get('/scans', (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    res.json(stmt.scans.all(req.doctor.id, limit));
  });

  r.post('/scan', async (req, res) => {
    try {
      const out = await redeem({
        doctorId: req.doctor.id,
        code: req.body?.code,
        position: String(req.body?.position || '').slice(0, 100),
      });
      res.json(out);
    } catch (err) {
      if (err instanceof ScanError) return res.status(err.status).json({ error: err.message, ...err.extra });
      throw err;
    }
  });

  return r;
}
