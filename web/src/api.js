export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, params, signal) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    : '';
  let res;
  try {
    res = await fetch(`./api${path}${qs}`, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('网络不稳定，请检查网络后重试', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || '服务暂时不可用，请稍后再试', res.status);
  return body;
}

export const api = {
  meta: () => request('/meta'),
  searchDoctors: (q, city, signal) => request('/doctors', { q, city }, signal),
  searchOrgs: (q, signal) => request('/orgs', { q }, signal),
  doctor: (id) => request(`/doctors/${encodeURIComponent(id)}`),
  org: (id) => request(`/orgs/${encodeURIComponent(id)}`),
};

export const PRODUCT = { blue: 'JUVELOOK', black: 'JUVELOOK Volume' };
export const PRODUCT_SHORT = { blue: 'JUVELOOK', black: 'Volume' };
