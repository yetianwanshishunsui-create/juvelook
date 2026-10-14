// 医生 / 机构的校验与写入，后台表单与 Excel 导入共用同一套规则
import { newId } from './db.js';

const STATUSES = ['active', 'revoked'];
const MOBILE_RE = /^1\d{10}$/;
const CODE_RE = /^[A-Za-z0-9-]{1,32}$/;

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const bool = (v) => v === true || v === 1 || ['1', '是', 'Y', 'y', 'yes', 'true', '√', '✓'].includes(String(v ?? '').trim());
const count = (v) => {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : NaN;
};

export function validateOrg(input) {
  const errors = {};
  const v = {
    name: str(input.name, 60),
    city: str(input.city, 20),
    address: str(input.address, 120),
    code: str(input.code, 32) || null,
    auth_blue: bool(input.auth_blue) ? 1 : 0,
    auth_black: bool(input.auth_black) ? 1 : 0,
    status: STATUSES.includes(input.status) ? input.status : 'active',
  };
  if (!v.name) errors.name = '请填写机构名称';
  if (!v.city) errors.city = '请填写所在城市';
  if (v.code && !CODE_RE.test(v.code)) errors.code = '编号只能包含字母、数字和短横线';
  if (!v.auth_blue && !v.auth_black) errors.products = '请至少授权一个产品';
  return { value: v, errors };
}

export function validateDoctor(input) {
  const errors = {};
  const v = {
    name: str(input.name, 20),
    org_id: str(input.org_id, 40),
    mobile: str(input.mobile, 20).replace(/[\s-]/g, ''),
    code: str(input.code, 32) || null,
    blue_count: count(input.blue_count),
    black_count: count(input.black_count),
    status: STATUSES.includes(input.status) ? input.status : 'active',
  };
  if (!v.name) errors.name = '请填写医生姓名';
  if (!v.org_id) errors.org_id = '请选择所属机构';
  if (v.mobile && !MOBILE_RE.test(v.mobile)) errors.mobile = '手机号格式不正确';
  if (v.code && !CODE_RE.test(v.code)) errors.code = '编号只能包含字母、数字和短横线';
  if (Number.isNaN(v.blue_count)) errors.blue_count = '支数须为非负整数';
  if (Number.isNaN(v.black_count)) errors.black_count = '支数须为非负整数';
  return { value: v, errors };
}

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
