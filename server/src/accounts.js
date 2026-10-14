import { randomBytes } from 'node:crypto';
import { newId } from './db.js';
import { hashPassword } from './auth.js';

// 创建或重置后台账号；未给密码时生成随机密码并返回
export function upsertAdmin(db, { username, password, name = '' }) {
  const pass = password || randomBytes(9).toString('base64url');
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').run(hashPassword(pass), existing.id);
    db.prepare(`DELETE FROM sessions WHERE kind = 'admin' AND subject_id = ?`).run(existing.id);
  } else {
    db.prepare('INSERT INTO admins (id, username, name, pass_hash) VALUES (?, ?, ?, ?)').run(newId(), username, name, hashPassword(pass));
  }
  return { username, password: pass, created: !existing };
}
