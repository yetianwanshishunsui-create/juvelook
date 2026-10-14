// 数据库：Node 内置 SQLite（node:sqlite），无需编译原生依赖。
// 表结构按合同一期整体设计：医生 / 机构 / 扫码核销记录，后台与扫码核销在后续阶段直接复用。
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

// 对外 ID 用随机串而不是自增数字，避免被按序号遍历抓取医生信息
export const newId = () => randomBytes(9).toString('base64url');

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
];

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
