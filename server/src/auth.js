// 鉴权：scrypt 密码哈希 + 服务端会话（HttpOnly Cookie），后台与医生端共用
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const SCRYPT_N = 16384;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [algo, n, salt, key] = String(stored).split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n) });
  return timingSafeEqual(actual, expected);
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export const COOKIE = { admin: 'jvl_admin', doctor: 'jvl_doctor' };
const TTL_MS = { admin: 12 * 3600_000, doctor: 30 * 24 * 3600_000 };

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSessions(db, { secureCookie }) {
  const stmt = {
    insert: db.prepare('INSERT INTO sessions (token_hash, kind, subject_id, expires_at) VALUES (?, ?, ?, ?)'),
    get: db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND kind = ?'),
    del: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    delSubject: db.prepare('DELETE FROM sessions WHERE kind = ? AND subject_id = ?'),
    purge: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  };

  const cookieAttrs = (maxAgeSec) =>
    `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureCookie ? '; Secure' : ''}`;

  return {
    start(res, kind, subjectId) {
      stmt.purge.run(Date.now());
      const token = randomBytes(32).toString('base64url');
      stmt.insert.run(sha256(token), kind, subjectId, Date.now() + TTL_MS[kind]);
      res.append('Set-Cookie', `${COOKIE[kind]}=${token}; ${cookieAttrs(TTL_MS[kind] / 1000)}`);
    },
    end(req, res, kind) {
      const token = parseCookies(req.headers.cookie)[COOKIE[kind]];
      if (token) stmt.del.run(sha256(token));
      res.append('Set-Cookie', `${COOKIE[kind]}=; ${cookieAttrs(0)}`);
    },
    // 修改密码 / 停用账号后让该主体所有会话失效
    revokeAll(kind, subjectId) {
      stmt.delSubject.run(kind, subjectId);
    },
    lookup(req, kind) {
      const token = parseCookies(req.headers.cookie)[COOKIE[kind]];
      if (!token) return null;
      const s = stmt.get.get(sha256(token), kind);
      if (!s || s.expires_at < Date.now()) return null;
      return s.subject_id;
    },
  };
}

// 登录失败节流：同一 key（账号 + IP）15 分钟内失败 5 次即锁定
export function createLoginThrottle({ max = 5, windowMs = 15 * 60_000 } = {}) {
  const fails = new Map();
  return {
    blocked(key) {
      const f = fails.get(key);
      if (!f) return false;
      if (Date.now() - f.first > windowMs) {
        fails.delete(key);
        return false;
      }
      return f.count >= max;
    },
    fail(key) {
      const f = fails.get(key);
      if (!f || Date.now() - f.first > windowMs) fails.set(key, { count: 1, first: Date.now() });
      else f.count++;
    },
    reset(key) {
      fails.delete(key);
    },
  };
}
