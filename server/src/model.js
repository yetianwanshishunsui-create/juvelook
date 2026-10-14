// 医生 / 机构的校验与写入，后台表单与 Excel 导入共用同一套规则
import { newId } from './db.js';
import { validateOrg, validateDoctor } from './validate.js';

export { validateOrg, validateDoctor };

export class ConflictError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

export function createModel(db) {
  const stmt = {
    orgByName: db.prepare('SELECT * FROM orgs WHERE name = ?'),
    orgByCode: db.prepare('SELECT * FROM orgs WHERE code = ?'),
    org: db.prepare('SELECT * FROM orgs WHERE id = ?'),
    docByCode: db.prepare('SELECT * FROM doctors WHERE code = ?'),
    doctor: db.prepare('SELECT * FROM doctors WHERE id = ?'),
    maxCode: db.prepare(
      `SELECT MAX(CAST(SUBSTR(code, :plen + 1) AS INTEGER)) AS n FROM (
         SELECT code FROM orgs UNION ALL SELECT code FROM doctors
       ) WHERE code LIKE :prefix || '%' AND SUBSTR(code, :plen + 1) GLOB '[0-9]*'`,
    ),
    insOrg: db.prepare(
      `INSERT INTO orgs (id, code, name, city, address, auth_blue, auth_black, status)
       VALUES (:id, :code, :name, :city, :address, :auth_blue, :auth_black, :status)`,
    ),
    updOrg: db.prepare(
      `UPDATE orgs SET code = :code, name = :name, city = :city, address = :address, auth_blue = :auth_blue,
       auth_black = :auth_black, status = :status, updated_at = datetime('now','localtime') WHERE id = :id`,
    ),
    insDoc: db.prepare(
      `INSERT INTO doctors (id, code, name, org_id, mobile, blue_count, black_count, status)
       VALUES (:id, :code, :name, :org_id, :mobile, :blue_count, :black_count, :status)`,
    ),
    updDoc: db.prepare(
      `UPDATE doctors SET code = :code, name = :name, org_id = :org_id, mobile = :mobile, blue_count = :blue_count,
       black_count = :black_count, status = :status, updated_at = datetime('now','localtime') WHERE id = :id`,
    ),
  };

  // 未填编号时按「前缀 + 4 位流水号」自动生成
  const nextCode = (prefix) => {
    const n = stmt.maxCode.get({ prefix, plen: prefix.length }).n || 0;
    return `${prefix}${String(n + 1).padStart(4, '0')}`;
  };

  function checkOrgUnique(v, id) {
    const byName = stmt.orgByName.get(v.name);
    if (byName && byName.id !== id) throw new ConflictError('name', `机构「${v.name}」已存在`);
    const byCode = v.code && stmt.orgByCode.get(v.code);
    if (byCode && byCode.id !== id) throw new ConflictError('code', `编号 ${v.code} 已被「${byCode.name}」使用`);
  }

  function checkDoctor(v, id) {
    if (!stmt.org.get(v.org_id)) throw new ConflictError('org_id', '所属机构不存在');
    const byCode = v.code && stmt.docByCode.get(v.code);
    if (byCode && byCode.id !== id) throw new ConflictError('code', `编号 ${v.code} 已被医生「${byCode.name}」使用`);
  }

  return {
    nextCode,
    createOrg(v) {
      checkOrgUnique(v);
      const row = { ...v, id: newId(), code: v.code || nextCode('JVL-O') };
      stmt.insOrg.run(row);
      return stmt.org.get(row.id);
    },
    updateOrg(id, v) {
      const cur = stmt.org.get(id);
      if (!cur) return null;
      checkOrgUnique(v, id);
      stmt.updOrg.run({ ...v, id, code: v.code || cur.code });
      return stmt.org.get(id);
    },
    createDoctor(v) {
      checkDoctor(v);
      const row = { ...v, id: newId(), code: v.code || nextCode('JVL-D') };
      stmt.insDoc.run(row);
      return stmt.doctor.get(row.id);
    },
    updateDoctor(id, v) {
      const cur = stmt.doctor.get(id);
      if (!cur) return null;
      checkDoctor(v, id);
      stmt.updDoc.run({ ...v, id, code: v.code || cur.code });
      return stmt.doctor.get(id);
    },
  };
}
