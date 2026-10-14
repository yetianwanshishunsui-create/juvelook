// 扫码核销：验真 → 判品类 → 校验机构授权 → 同一事务内写核销记录并累加医生支数
import { newId, tx } from './db.js';
import { classifyProduct, normalizeCode, VerifyUnavailable } from './verify.js';

export { normalizeCode };

export class ScanError extends Error {
  constructor(message, status, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const PRODUCT = { blue: 'JUVELOOK', black: 'JUVELOOK Volume' };

const isExpired = (date) => {
  const t = Date.parse(String(date).replace(' ', 'T'));
  return Number.isFinite(t) && t < Date.now();
};

export function createScanService(db, { verify, allowExpired = false, fallbackKind = null }) {
  const stmt = {
    existing: db.prepare(
      `SELECT s.created_at, d.name AS doctor_name, s.doctor_id FROM scans s JOIN doctors d ON d.id = s.doctor_id WHERE s.code = ?`,
    ),
    doctor: db.prepare(
      `SELECT d.*, o.auth_blue, o.auth_black, o.status AS org_status FROM doctors d JOIN orgs o ON o.id = d.org_id WHERE d.id = ?`,
    ),
    insert: db.prepare(
      `INSERT INTO scans (id, code, doctor_id, org_id, kind, product_name, batch_number, position_flag, verify_raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    incBlue: db.prepare(`UPDATE doctors SET blue_count = blue_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`),
    incBlack: db.prepare(`UPDATE doctors SET black_count = black_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`),
  };

  function alreadyUsed(code, doctorId) {
    const prev = stmt.existing.get(code);
    if (!prev) return;
    // 他人核销的码不暴露对方姓名
    const who = prev.doctor_id === doctorId ? '您' : '其他医生';
    throw new ScanError(`该码已于 ${prev.created_at} 由${who}核销，不能重复计数`, 409);
  }

  return async function redeem({ doctorId, code: rawCode, position }) {
    const code = normalizeCode(rawCode);
    if (!code) throw new ScanError('未识别到防伪码', 400);

    const doc = stmt.doctor.get(doctorId);
    if (!doc || doc.status !== 'active' || doc.org_status !== 'active') {
      throw new ScanError('您的认证状态异常，请联系品牌方', 403);
    }

    // 先查本地，已核销的码不必再调验真接口
    alreadyUsed(code, doctorId);

    let v;
    try {
      v = await verify({ code, position, mobile: doc.mobile });
    } catch (err) {
      if (err instanceof VerifyUnavailable) throw new ScanError('验真服务暂不可用，请稍后重试', 503);
      throw err;
    }
    if (!v.ok) throw new ScanError(`验真未通过：${v.reason}`, 422);

    const kind = classifyProduct(v.productName) || fallbackKind;
    if (!kind) throw new ScanError(`无法识别产品品类：${v.productName || '未知产品'}`, 422);
    if (!allowExpired && v.expirationDate && isExpired(v.expirationDate)) {
      throw new ScanError(`该产品已过有效期（${v.expirationDate.slice(0, 10)}），不予核销`, 422);
    }
    if (!(kind === 'blue' ? doc.auth_blue : doc.auth_black)) {
      throw new ScanError(`您所在机构未获 ${PRODUCT[kind]} 授权，不能核销`, 403);
    }

    try {
      tx(db, () => {
        stmt.insert.run(
          newId(), code, doctorId, doc.org_id, kind, v.productName, v.batchNumber, v.positionFlag, JSON.stringify(v.raw),
        );
        (kind === 'blue' ? stmt.incBlue : stmt.incBlack).run(doctorId);
      });
    } catch (err) {
      // 并发扫同一码：唯一约束兜底
      if (/UNIQUE/.test(err.message)) alreadyUsed(code, doctorId);
      throw err;
    }

    const after = stmt.doctor.get(doctorId);
    return {
      kind,
      product: PRODUCT[kind],
      productName: v.productName,
      batchNumber: v.batchNumber,
      code,
      // 验真平台判定窜货时提示，核销照常记录，后台可查
      diverted: v.positionFlag === '1',
      counts: { blue: after.blue_count, black: after.black_count },
    };
  };
}
