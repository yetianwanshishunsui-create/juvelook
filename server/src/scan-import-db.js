// 扫码数据导入：数据库查询与写入（服务端）
import { newId, tx } from './db.js';
import { parseScanWorkbook, planScanImport } from './scan-import.js';

export function createScanImporter(db) {
  const stmt = {
    byPhone: db.prepare(
      `SELECT d.id, d.name, d.code, o.name AS org_name, o.auth_blue, o.auth_black
       FROM doctors d JOIN orgs o ON o.id = d.org_id WHERE d.mobile = ?`,
    ),
    existing: db.prepare('SELECT created_at, source FROM scans WHERE code = ?'),
    doctorOrg: db.prepare('SELECT org_id FROM doctors WHERE id = ?'),
    insert: db.prepare(
      `INSERT INTO scans (id, code, doctor_id, org_id, kind, product_name, batch_number, position_flag, verify_raw, created_at, source, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'import', ?)`,
    ),
    incBlue: db.prepare(`UPDATE doctors SET blue_count = blue_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`),
    incBlack: db.prepare(`UPDATE doctors SET black_count = black_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`),
  };

  const lookups = {
    doctorByPhone: (phone) => {
      const rows = stmt.byPhone.all(phone);
      return rows.length > 1 ? 'ambiguous' : rows[0] || null;
    },
    existingScan: (code) => stmt.existing.get(code) || null,
  };

  return {
    async plan(buffer) {
      return planScanImport(await parseScanWorkbook(buffer), lookups);
    },
    // 写入时在事务内重新生成计划，避免预览之后数据变化导致重复计数
    async apply(buffer) {
      const rows = await parseScanWorkbook(buffer);
      const batchId = newId();
      const plan = tx(db, () => {
        const p = planScanImport(rows, lookups);
        for (const it of p.items) {
          const orgId = stmt.doctorOrg.get(it.doctorId).org_id;
          stmt.insert.run(newId(), it.code, it.doctorId, orgId, it.kind, it.productName, it.batchNumber, JSON.stringify(it.raw), it.time, batchId);
          (it.kind === 'blue' ? stmt.incBlue : stmt.incBlack).run(it.doctorId);
        }
        return p;
      });
      return { batchId, plan };
    },
  };
}
