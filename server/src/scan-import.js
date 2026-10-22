// 小程序扫码数据导入（「扫码验真记录数据导出」表格）：解析 → 逐行判定 → 生成导入计划。
// 不依赖数据库，服务端与浏览器测试版共用；写库见 scan-import-db.js。
//
// 判定规则（按顺序，命中即停）：
//   非医生身份的扫码（消费者验真等） → 跳过，不计数
//   验证结果不是「正常」              → 跳过，不计数
//   缺少产品标识 / 手机号 / 时间        → 有问题
//   无法判断 JUVELOOK 还是 Volume      → 有问题
//   手机号在系统中找不到医生           → 有问题（补录医生后重新导入同一文件即可）
//   医生所在机构未授权该产品           → 有问题
//   产品标识已在系统中计过数           → 跳过（重复导入、同一支多次扫码都只算一次）
//   同一文件中产品标识重复             → 只保留最早的一次
//   其余                               → 导入，医生对应产品支数 +1
//   另：表格「用户姓名」与系统医生姓名不一致时，在按医生汇总中提示核对（仍计入）
import ExcelJS from 'exceljs';

const COLUMNS = {
  userId: ['用户ID'],
  name: ['用户姓名'],
  phone: ['手机号'],
  role: ['用户身份'],
  result: ['验证结果'],
  productFull: ['产品名称'],
  productShort: ['产品名称（显示）', '产品名称(显示)'],
  code: ['产品标识'],
  batch: ['批次号'],
  expiry: ['使用期限'],
  time: ['验证时间'],
};
const REQUIRED = ['phone', 'role', 'result', 'code', 'time'];
const LABEL = { phone: '手机号', role: '用户身份', result: '验证结果', code: '产品标识', time: '验证时间' };

const PRODUCT = { blue: 'JUVELOOK', black: 'JUVELOOK Volume' };

// 品类：先认 Volume / 黑瓶，再认 蓝瓶 / JUVELOOK
export function classifyImported(short, full) {
  const t = `${short || ''} ${full || ''}`.toLowerCase();
  if (t.includes('volume') || t.includes('黑瓶') || t.includes('juvelook-v')) return 'black';
  if (t.includes('蓝瓶') || t.includes('juvelook')) return 'blue';
  return null;
}

const pad = (n) => String(n).padStart(2, '0');

// 单元格转文本：Excel 日期按「表格里看到的时间」取值（ExcelJS 以 UTC 表示）
function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
  }
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if ('result' in v) return cellText(v.result);
    if (v.text != null) return cellText(v.text);
  }
  return String(v).trim();
}

// 时间统一成 YYYY-MM-DD HH:mm:ss；无法识别返回 ''
export function normalizeTime(s) {
  const m = String(s).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!m) return '';
  const [, y, mo, d, h = '0', mi = '0', se = '0'] = m;
  return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(se)}`;
}

export const normalizePhone = (s) => {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('86') ? digits.slice(2) : digits;
};

export async function parseScanWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error('无法读取文件，请上传 .xlsx 格式的 Excel 文件');
  }
  // 找到含「产品标识」「手机号」表头的工作表与表头行（表头不一定在第 1 行）
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
      const heads = ws.getRow(r).values.map((v) => cellText(v).replace(/\s/g, ''));
      const index = {};
      for (const [key, names] of Object.entries(COLUMNS)) {
        const i = heads.findIndex((h) => names.includes(h));
        if (i > 0) index[key] = i;
      }
      if (!index.code || !index.phone) continue;
      const missing = REQUIRED.filter((k) => !index[k]);
      if (missing.length) throw new Error(`表格缺少列：${missing.map((k) => LABEL[k]).join('、')}`);
      const rows = [];
      ws.eachRow({ includeEmpty: false }, (row, n) => {
        if (n <= r) return;
        const rec = { row: n };
        for (const key of Object.keys(COLUMNS)) rec[key] = index[key] ? cellText(row.getCell(index[key]).value) : '';
        if (rec.code || rec.phone) rows.push(rec);
      });
      return rows;
    }
  }
  throw new Error('没有找到扫码数据：请上传小程序导出的「扫码验真记录」表格（需包含「产品标识」「手机号」列）');
}

/**
 * 生成导入计划。
 * lookups.doctorByPhone(phone) → { id, name, code, org_name, auth_blue, auth_black } | 'ambiguous' | null
 * lookups.existingScan(code)    → { created_at, source } | null
 */
export function planScanImport(rows, lookups) {
  const items = [];
  const issues = [];
  const skipped = { notDoctor: 0, abnormal: 0, duplicate: 0 };
  const seen = new Map(); // 产品标识 → 本文件中采用的那一行
  const sorted = [...rows].sort((a, b) => normalizeTime(a.time).localeCompare(normalizeTime(b.time)) || a.row - b.row);

  for (const r of sorted) {
    const base = { row: r.row, name: r.name, phone: r.phone, code: r.code, product: r.productShort || r.productFull, time: r.time };
    if (!String(r.role).includes('医生')) { skipped.notDoctor++; continue; }
    if (String(r.result).trim() !== '正常') { skipped.abnormal++; continue; }

    const code = String(r.code).replace(/\s+/g, '');
    const phone = normalizePhone(r.phone);
    const time = normalizeTime(r.time);
    const problem = (reason) => issues.push({ ...base, reason });
    if (!code) { problem('缺少产品标识'); continue; }
    if (!/^1\d{10}$/.test(phone)) { problem('手机号缺失或格式不正确'); continue; }
    if (!time) { problem('验证时间无法识别'); continue; }
    const kind = classifyImported(r.productShort, r.productFull);
    if (!kind) { problem('无法判断是 JUVELOOK 还是 JUVELOOK Volume'); continue; }

    const existing = lookups.existingScan(code);
    if (existing) { skipped.duplicate++; continue; }
    if (seen.has(code)) { skipped.duplicate++; continue; }

    const doc = lookups.doctorByPhone(phone);
    if (!doc) { problem('系统中没有这个手机号的医生'); continue; }
    if (doc === 'ambiguous') { problem('系统中有多位医生使用这个手机号，请先在后台修正'); continue; }
    if (!(kind === 'blue' ? doc.auth_blue : doc.auth_black)) {
      problem(`医生所在机构未授权 ${PRODUCT[kind]}`);
      continue;
    }

    seen.set(code, r.row);
    items.push({
      row: r.row, code, kind, time, phone, doctorId: doc.id,
      batchNumber: r.batch, productName: r.productFull || r.productShort,
      raw: r,
    });
  }

  // 按医生汇总，便于确认前核对
  const byDoctor = new Map();
  for (const it of items) {
    const d = lookups.doctorByPhone(it.phone);
    const agg = byDoctor.get(d.id) || { doctorId: d.id, name: d.name, code: d.code, org: d.org_name, phone: it.phone, blue: 0, black: 0, sheetNames: [] };
    agg[it.kind]++;
    // 表格里的姓名与系统不一致时提示核对（可能是系统中手机号录错，支数会算到别人名下）；不拦截
    const sheetName = String(it.raw.name || '').trim();
    if (sheetName && sheetName !== d.name && !agg.sheetNames.includes(sheetName)) agg.sheetNames.push(sheetName);
    byDoctor.set(d.id, agg);
  }
  const nameMismatch = [...byDoctor.values()].filter((d) => d.sheetNames.length).length;
  issues.sort((a, b) => a.row - b.row);

  return {
    items,
    issues,
    doctors: [...byDoctor.values()].sort((a, b) => b.blue + b.black - (a.blue + a.black)),
    summary: {
      totalRows: rows.length,
      importable: items.length,
      blue: items.filter((i) => i.kind === 'blue').length,
      black: items.filter((i) => i.kind === 'black').length,
      doctorCount: byDoctor.size,
      skippedNotDoctor: skipped.notDoctor,
      skippedAbnormal: skipped.abnormal,
      skippedDuplicate: skipped.duplicate,
      issueRows: issues.length,
      nameMismatch,
    },
  };
}
