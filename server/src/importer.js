// Excel 批量导入：生成模板 → 解析 → 生成导入计划（逐行校验、去重、新增 / 更新）→ 确认后整体写入
import ExcelJS from 'exceljs';
import { tx } from './db.js';
import { validateOrg, validateDoctor, ConflictError } from './model.js';

const ORG_COLS = [
  { key: 'name', header: '机构名称*', width: 28, match: ['机构名称'] },
  { key: 'city', header: '所在城市*', width: 12, match: ['城市'] },
  { key: 'address', header: '机构地址', width: 40, match: ['地址'] },
  { key: 'auth_blue', header: '授权 JUVELOOK（是/否）', width: 22, match: ['授权juvelook（', '授权juvelook(', '授权juvelook'] },
  { key: 'auth_black', header: '授权 Volume（是/否）', width: 20, match: ['授权volume'] },
  { key: 'code', header: '授权编号（选填）', width: 18, match: ['编号'] },
];
const DOC_COLS = [
  { key: 'name', header: '医生姓名*', width: 14, match: ['医生姓名', '姓名'] },
  { key: 'org_name', header: '所属机构名称*', width: 28, match: ['机构'] },
  { key: 'mobile', header: '手机号', width: 16, match: ['手机'] },
  { key: 'code', header: '认证编号（选填）', width: 18, match: ['编号'] },
  { key: 'blue_count', header: 'JUVELOOK 初始支数', width: 18, match: ['juvelook初始', 'juvelook支数'] },
  { key: 'black_count', header: 'Volume 初始支数', width: 16, match: ['volume'] },
];
const ORG_SHEET = '机构';
const DOC_SHEET = '医生';

export async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  const add = (name, cols, samples) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0057B8' } };
    samples.forEach((s) => ws.addRow(s));
    // 手机号 / 编号按文本处理，避免 Excel 转成科学计数法
    cols.forEach((c, i) => {
      if (['mobile', 'code'].includes(c.key)) ws.getColumn(i + 1).numFmt = '@';
    });
  };
  add(ORG_SHEET, ORG_COLS, [
    { name: '示例·静安某某医疗美容门诊部', city: '上海', address: '上海市静安区某某路 1 号', auth_blue: '是', auth_black: '是', code: '' },
  ]);
  add(DOC_SHEET, DOC_COLS, [
    { name: '示例·张三', org_name: '示例·静安某某医疗美容门诊部', mobile: '13800000000', code: '', blue_count: 0, black_count: 0 },
  ]);
  const help = wb.addWorksheet('填写说明');
  help.getColumn(1).width = 100;
  [
    'juvelook 认证查询系统 · 数据导入模板',
    '',
    '1. 带 * 的列必填；导入前请删除「示例·」开头的示例行。',
    '2. 「机构」表：同名机构视为同一家，已存在则更新其城市、地址、授权产品和编号。',
    '3. 「医生」表：「所属机构名称」须与「机构」表或系统中已有机构名称完全一致。',
    '4. 医生匹配规则：填写认证编号的按编号匹配，否则按「姓名 + 所属机构」匹配；匹配到则更新，否则新增。',
    '5. 初始支数仅对新增医生生效；已有医生的支数含扫码核销累计，导入不会覆盖，如需修改请在后台单独编辑。',
    '6. 编号留空时系统自动生成（机构 JVL-O0001，医生 JVL-D0001 起）。',
    '7. 手机号用于医生端登录（认证编号 + 手机号），建议填写。',
    '8. 上传后系统会先逐行校验并给出预览，确认无误后才会写入。',
  ].forEach((t, i) => {
    help.addRow([t]);
    if (i === 0) help.getRow(1).font = { bold: true, size: 14 };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// 单元格值统一转文本（富文本、公式、超链接、数字）
function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return cellText(v.result);
    if (v.text != null) return cellText(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

const squash = (s) => s.toLowerCase().replace(/[\s*]/g, '');

function readSheet(ws, cols) {
  if (!ws) return [];
  const header = ws.getRow(1).values.map((h) => squash(cellText(h)));
  const index = {};
  for (const c of cols) {
    const i = header.findIndex((h, j) => h && !Object.values(index).includes(j) && c.match.some((m) => h.includes(m)));
    if (i > 0) index[c.key] = i;
  }
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const rec = { _row: rowNumber };
    for (const c of cols) rec[c.key] = index[c.key] ? cellText(row.getCell(index[c.key]).value) : '';
    if (cols.some((c) => rec[c.key] !== '')) rows.push(rec);
  });
  return rows;
}

export async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error('无法读取文件，请上传 .xlsx 格式的 Excel 文件');
  }
  const orgSheet = wb.getWorksheet(ORG_SHEET);
  const docSheet = wb.getWorksheet(DOC_SHEET);
  if (!orgSheet && !docSheet) throw new Error('未找到「机构」或「医生」工作表，请使用系统模板');
  return { orgs: readSheet(orgSheet, ORG_COLS), doctors: readSheet(docSheet, DOC_COLS) };
}

const isSample = (s) => String(s).startsWith('示例·');

export function planImport(db, parsed) {
  const q = {
    orgByName: db.prepare('SELECT * FROM orgs WHERE name = ?'),
    orgByCode: db.prepare('SELECT * FROM orgs WHERE code = ?'),
    docByCode: db.prepare('SELECT * FROM doctors WHERE code = ?'),
    docByNameOrg: db.prepare('SELECT * FROM doctors WHERE name = ? AND org_id = ?'),
  };

  const orgs = [];
  const seenOrg = new Map(); // name -> row
  const seenOrgCode = new Map();
  for (const r of parsed.orgs) {
    if (isSample(r.name)) continue;
    const { value, errors } = validateOrg(r);
    const errs = Object.values(errors);
    const existing = value.name ? q.orgByName.get(value.name) : null;
    if (value.name && seenOrg.has(value.name)) errs.push(`与第 ${seenOrg.get(value.name)} 行机构重名`);
    if (value.code) {
      if (seenOrgCode.has(value.code)) errs.push(`编号与第 ${seenOrgCode.get(value.code)} 行重复`);
      const byCode = q.orgByCode.get(value.code);
      if (byCode && byCode.id !== existing?.id) errs.push(`编号 ${value.code} 已被「${byCode.name}」使用`);
      seenOrgCode.set(value.code, r._row);
    }
    if (value.name) seenOrg.set(value.name, r._row);
    orgs.push({ row: r._row, name: value.name, city: value.city, action: existing ? 'update' : 'create', id: existing?.id, value, errors: errs });
  }

  const doctors = [];
  const seenDocCode = new Map();
  const seenDocKey = new Map();
  for (const r of parsed.doctors) {
    if (isSample(r.name)) continue;
    const orgName = String(r.org_name || '').trim();
    const orgInFile = orgs.find((o) => o.name === orgName);
    const orgInDb = orgName ? q.orgByName.get(orgName) : null;
    // org_id 先用占位，校验通过后写入时再按名称解析
    const { value, errors } = validateDoctor({ ...r, org_id: orgInDb?.id || (orgInFile ? 'pending' : '') });
    const errs = Object.values(errors).filter((e) => e !== '请选择所属机构');
    if (!orgName) errs.push('请填写所属机构名称');
    else if (!orgInDb && !orgInFile) errs.push(`机构「${orgName}」不存在，请先在「机构」表中添加`);

    let existing = null;
    if (value.code) {
      existing = q.docByCode.get(value.code);
      if (seenDocCode.has(value.code)) errs.push(`认证编号与第 ${seenDocCode.get(value.code)} 行重复`);
      seenDocCode.set(value.code, r._row);
    } else if (orgInDb && value.name) {
      const same = q.docByNameOrg.all(value.name, orgInDb.id);
      if (same.length > 1) errs.push('系统中该机构有多位同名医生，请填写认证编号区分');
      existing = same[0] || null;
    }
    const key = `${value.name}@${orgName}`;
    if (!value.code && seenDocKey.has(key)) errs.push(`与第 ${seenDocKey.get(key)} 行重复`);
    seenDocKey.set(key, r._row);

    doctors.push({
      row: r._row, name: value.name, orgName, action: existing ? 'update' : 'create', id: existing?.id,
      value, errors: errs,
    });
  }

  const count = (list, a) => list.filter((x) => !x.errors.length && x.action === a).length;
  return {
    orgs,
    doctors,
    summary: {
      orgCreate: count(orgs, 'create'),
      orgUpdate: count(orgs, 'update'),
      doctorCreate: count(doctors, 'create'),
      doctorUpdate: count(doctors, 'update'),
      errorRows: [...orgs, ...doctors].filter((x) => x.errors.length).length,
    },
  };
}

// 计划无错误时整体写入；任何一行失败则全部回滚
export function applyImport(db, model, plan) {
  if (plan.summary.errorRows) throw new Error('存在校验错误的行，请修正后重新上传');
  const orgByName = db.prepare('SELECT * FROM orgs WHERE name = ?');
  const docById = db.prepare('SELECT * FROM doctors WHERE id = ?');
  return tx(db, () => {
    try {
      for (const o of plan.orgs) {
        if (o.action === 'create') model.createOrg(o.value);
        else model.updateOrg(o.id, { ...o.value, status: orgByName.get(o.name).status });
      }
      for (const d of plan.doctors) {
        const org = orgByName.get(d.orgName);
        if (d.action === 'create') {
          model.createDoctor({ ...d.value, org_id: org.id });
        } else {
          // 已有医生：保留支数与认证状态，只更新资料
          const cur = docById.get(d.id);
          model.updateDoctor(d.id, {
            ...d.value, org_id: org.id, mobile: d.value.mobile || cur.mobile,
            blue_count: cur.blue_count, black_count: cur.black_count, status: cur.status,
          });
        }
      }
    } catch (err) {
      if (err instanceof ConflictError) throw new Error(err.message);
      throw err;
    }
    return plan.summary;
  });
}
