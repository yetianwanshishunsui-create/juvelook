import { request, IS_DEMO } from '../api.js';
import { session } from './store.js';

// 后台请求：会话失效时统一跳回登录页
async function call(method, path, opts) {
  try {
    return await request(method, `/admin${path}`, opts);
  } catch (err) {
    if (err.status === 401 && !['/login', '/me'].includes(path)) session.expired();
    throw err;
  }
}

export const adminApi = {
  login: (username, password) => call('POST', '/login', { body: { username, password } }),
  logout: () => call('POST', '/logout'),
  me: () => call('GET', '/me'),
  changePassword: (oldPassword, newPassword) => call('POST', '/password', { body: { oldPassword, newPassword } }),
  stats: () => call('GET', '/stats'),
  orgOptions: () => call('GET', '/orgs/options'),
  orgs: (params) => call('GET', '/orgs', { params }),
  createOrg: (body) => call('POST', '/orgs', { body }),
  updateOrg: (id, body) => call('PUT', `/orgs/${id}`, { body }),
  deleteOrg: (id) => call('DELETE', `/orgs/${id}`),
  doctors: (params) => call('GET', '/doctors', { params }),
  createDoctor: (body) => call('POST', '/doctors', { body }),
  updateDoctor: (id, body) => call('PUT', `/doctors/${id}`, { body }),
  deleteDoctor: (id) => call('DELETE', `/doctors/${id}`),
  scans: (params) => call('GET', '/scans', { params }),
  audit: (params) => call('GET', '/audit', { params }),
  importPreview: (file) => call('POST', '/import/preview', { body: file }),
  importCommit: (file) => call('POST', '/import/commit', { body: file }),
  scanImportPreview: (file) => call('POST', '/import/scans/preview', { body: file }),
  scanImportCommit: (file) => call('POST', '/import/scans/commit', { body: file }),
  // 演示版无法下载文件（沙箱限制）
  templateUrl: IS_DEMO ? null : './api/admin/import/template',
};
