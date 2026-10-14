import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

// hash 路由：落地页 URL（# 之前）始终不变，后续接入微信 JS-SDK 时签名只需对一个地址计算
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/doctor/:id', name: 'doctor', component: () => import('./views/DoctorView.vue'), meta: { title: '医生详情' } },
    { path: '/org/:id', name: 'org', component: () => import('./views/OrgView.vue'), meta: { title: '机构详情' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · juvelook 认证查询` : 'juvelook 认证查询';
});
