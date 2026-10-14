// 医生 / 机构字段校验：服务端与在线演示版共用，不依赖数据库
export const STATUSES = ['active', 'revoked'];
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

