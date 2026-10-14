import { createRouter, createWebHashHistory } from 'vue-router';
import { session } from './store.js';
import { adminApi } from './api.js';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true, title: '登录' } },
    { path: '/', component: () => import('./views/DashboardView.vue'), meta: { title: '数据概览' } },
    { path: '/doctors', component: () => import('./views/DoctorsView.vue'), meta: { title: '医生管理' } },
    { path: '/orgs', component: () => import('./views/OrgsView.vue'), meta: { title: '机构管理' } },
    { path: '/scans', component: () => import('./views/ScansView.vue'), meta: { title: '核销记录' } },
    { path: '/import', component: () => import('./views/ImportView.vue'), meta: { title: '数据导入' } },
    { path: '/audit', component: () => import('./views/AuditView.vue'), meta: { title: '操作日志' } },
    { path: '/account', component: () => import('./views/AccountView.vue'), meta: { title: '账号设置' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

session.onExpired = () => router.replace({ path: '/login', query: { next: router.currentRoute.value.fullPath } });

router.beforeEach(async (to) => {
  if (!session.checked) {
    session.checked = true;
    session.user = await adminApi.me().catch(() => null);
  }
  if (!to.meta.public && !session.user) return { path: '/login', query: to.path !== '/' ? { next: to.fullPath } : {} };
  if (to.path === '/login' && session.user) return '/';
});

router.afterEach((to) => {
  document.title = `${to.meta.title || ''} · juvelook 运营后台`;
});
