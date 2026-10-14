import express from 'express';
import { existsSync } from 'node:fs';
import { createQueries } from './queries.js';
import { createSessions } from './auth.js';
import { createAdminRouter } from './admin.js';
import { createPortalRouter } from './portal.js';
import { createScanService } from './scan.js';
import { createVerifier } from './verify.js';
import { createWechat } from './wechat.js';

const MAX_QUERY_LEN = 40;

// 简单的按 IP 固定窗口限流，减缓对医生信息的批量抓取
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const n = (hits.get(req.ip) || 0) + 1;
    hits.set(req.ip, n);
    if (n > max) return res.status(429).json({ error: '查询过于频繁，请稍后再试' });
    next();
  };
}

const cleanQuery = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_QUERY_LEN) : '');

export function createApp(db, opts = {}) {
  const { staticDir, rateLimitMax = 120, secureCookie = false, verify: verifyCfg = { mode: 'mock' }, wechat: wechatCfg = {} } = opts;
  const q = createQueries(db);
  const app = express();
  // 部署在 Nginx 反向代理之后，取真实客户端 IP
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, max: rateLimitMax }));
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  api.use(express.json({ limit: '100kb' }));

  const sessions = createSessions(db, { secureCookie });
  const redeem = createScanService(db, {
    verify: opts.verifier || createVerifier(verifyCfg),
    allowExpired: !!verifyCfg.allowExpired,
    fallbackKind: verifyCfg.fallbackKind || null,
  });
  api.use('/admin', createAdminRouter(db, sessions));
  api.use('/portal', createPortalRouter(db, sessions, { redeem, wechat: createWechat(wechatCfg) }));

  api.get('/meta', (req, res) => res.json(q.meta()));

  // 医生查询：必须带姓名关键词或城市，不提供无条件的全量列表
  api.get('/doctors', (req, res) => {
    const kw = cleanQuery(req.query.q);
    const city = cleanQuery(req.query.city);
    if (!kw && !city) return res.status(400).json({ error: '请输入医生姓名或选择城市' });
    res.json(q.searchDoctors({ q: kw, city }));
  });

  api.get('/doctors/:id', (req, res) => {
    const d = q.doctor(req.params.id);
    if (!d) return res.status(404).json({ error: '未找到该医生' });
    res.json(d);
  });

  api.get('/orgs', (req, res) => {
    const kw = cleanQuery(req.query.q);
    if (!kw) return res.status(400).json({ error: '请输入机构名称' });
    res.json(q.searchOrgs({ q: kw }));
  });

  api.get('/orgs/:id', (req, res) => {
    const o = q.org(req.params.id);
    if (!o) return res.status(404).json({ error: '未找到该机构' });
    res.json(o);
  });

  api.use((req, res) => res.status(404).json({ error: '接口不存在' }));
  app.use('/api', api);

  // 生产环境由同一进程托管 H5 构建产物（前台使用 hash 路由，无需路由回退）
  if (staticDir && existsSync(staticDir)) {
    app.get('/admin', (req, res) => res.redirect('/admin.html'));
    app.use(
      express.static(staticDir, {
        setHeaders(res, path) {
          // 带 hash 的静态资源长缓存；index.html 不缓存，保证微信内能拿到新版本
          if (/[\\/]assets[\\/]/.test(path)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
          else res.set('Cache-Control', 'no-cache');
        },
      }),
    );
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // 请求体格式错误、过大等客户端错误
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: err.status === 413 ? '上传内容过大' : '请求格式不正确' });
    }
    console.error(err);
    res.status(500).json({ error: '服务异常，请稍后再试' });
  });

  return app;
}
