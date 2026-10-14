// 数据库：Node 内置 SQLite（node:sqlite），无需编译原生依赖。
// 表结构按合同一期整体设计：医生 / 机构 / 扫码核销记录，后台与扫码核销在后续阶段直接复用。
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export { newId } from './ids.js';

// 版本化迁移：PRAGMA user_version 记录已执行到第几条
const MIGRATIONS = [
  `
  CREATE TABLE orgs (
    id           TEXT PRIMARY KEY,
    code         TEXT UNIQUE,                       -- 机构授权编号（客户如有规则）
    name         TEXT NOT NULL,
    city         TEXT NOT NULL DEFAULT '',
    address      TEXT NOT NULL DEFAULT '',
    auth_blue    INTEGER NOT NULL DEFAULT 0,        -- 是否授权 JUVELOOK
    auth_black   INTEGER NOT NULL DEFAULT 0,        -- 是否授权 JUVELOOK Volume
    status       TEXT NOT NULL DEFAULT 'active',    -- active / revoked
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE UNIQUE INDEX orgs_name_uq ON orgs(name);

  CREATE TABLE doctors (
    id           TEXT PRIMARY KEY,
    code         TEXT UNIQUE,                       -- 医生认证编号（客户如有规则）
    name         TEXT NOT NULL,
    org_id       TEXT NOT NULL REFERENCES orgs(id),
    blue_count   INTEGER NOT NULL DEFAULT 0,        -- JUVELOOK 累计支数（录入 + 扫码核销累加）
    black_count  INTEGER NOT NULL DEFAULT 0,        -- JUVELOOK Volume 累计支数
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX doctors_org ON doctors(org_id);

  -- 扫码核销记录：防伪码全局唯一，一码只能核销一次
  CREATE TABLE scans (
    id             TEXT PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    doctor_id      TEXT NOT NULL REFERENCES doctors(id),
    org_id         TEXT NOT NULL REFERENCES orgs(id),
    kind           TEXT NOT NULL CHECK (kind IN ('blue','black')),
    product_name   TEXT,
    batch_number   TEXT,
    position_flag  TEXT,                            -- 验真接口返回的窜货标记 0/1/2
    verify_raw     TEXT,                            -- 验真接口原始返回，留痕
    created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX scans_doctor ON scans(doctor_id, created_at);
  `,
  `
  -- 医生端登录：认证编号 + 手机号；正式环境首次登录后绑定微信 openid
  ALTER TABLE doctors ADD COLUMN mobile TEXT NOT NULL DEFAULT '';
  ALTER TABLE doctors ADD COLUMN wx_openid TEXT;
  CREATE UNIQUE INDEX doctors_openid_uq ON doctors(wx_openid) WHERE wx_openid IS NOT NULL;
  CREATE INDEX scans_created ON scans(created_at);

  CREATE TABLE admins (
    id             TEXT PRIMARY KEY,
    username       TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL DEFAULT '',
    pass_hash      TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    last_login_at  TEXT
  );

  -- 登录会话：只存 token 的哈希，数据库泄露也无法冒用会话
  CREATE TABLE sessions (
    token_hash   TEXT PRIMARY KEY,
    kind         TEXT NOT NULL CHECK (kind IN ('admin','doctor')),
    subject_id   TEXT NOT NULL,
    expires_at   INTEGER NOT NULL
  );
  CREATE INDEX sessions_subject ON sessions(kind, subject_id);

  -- 后台操作留痕
  CREATE TABLE audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id    TEXT,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   TEXT,
    detail      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  `,
];

// 事务包装：fn 抛错则回滚
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return db;
}
