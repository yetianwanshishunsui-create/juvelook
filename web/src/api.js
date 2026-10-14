export class ApiError extends Error {
  constructor(message, status, body = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// 统一请求：GET 参数走 query，其他方法 JSON 体；Blob / ArrayBuffer 原样上传
export async function request(method, path, { params, body, signal } = {}) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
    : '';
  const headers = { Accept: 'application/json' };
  let payload;
  if (body instanceof Blob || body instanceof ArrayBuffer) {
    headers['Content-Type'] = 'application/octet-stream';
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`./api${path}${qs}`, { method, headers, body: payload, signal, credentials: 'same-origin' });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('网络不稳定，请检查网络后重试', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || '服务暂时不可用，请稍后再试', res.status, data);
  return data;
}

const get = (path, params, signal) => request('GET', path, { params, signal });
const post = (path, body) => request('POST', path, { body });

export const api = {
  meta: () => get('/meta'),
  searchDoctors: (q, city, signal) => get('/doctors', { q, city }, signal),
  searchOrgs: (q, signal) => get('/orgs', { q }, signal),
  doctor: (id) => get(`/doctors/${encodeURIComponent(id)}`),
  org: (id) => get(`/orgs/${encodeURIComponent(id)}`),
};

export const portalApi = {
  login: (code, mobile) => post('/portal/login', { code, mobile }),
  logout: () => post('/portal/logout'),
  me: () => get('/portal/me'),
  scans: () => get('/portal/scans', { limit: 20 }),
  scan: (code, position) => post('/portal/scan', { code, position }),
  wxConfig: (url) => get('/portal/wx-config', { url }),
};

export const PRODUCT = { blue: 'JUVELOOK', black: 'JUVELOOK Volume' };
export const PRODUCT_SHORT = { blue: 'JUVELOOK', black: 'Volume' };
