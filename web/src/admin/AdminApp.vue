<script setup>
import { useRoute, useRouter } from 'vue-router';
import Icon from '../components/Icon.vue';
import { session, toast, confirmBox } from './store.js';
import { adminApi } from './api.js';
import Modal from './components/Modal.vue';

const route = useRoute();
const router = useRouter();
const NAV = [
  { to: '/', label: '数据概览', icon: 'chart' },
  { to: '/doctors', label: '医生管理', icon: 'doc' },
  { to: '/orgs', label: '机构管理', icon: 'org' },
  { to: '/scans', label: '核销记录', icon: 'scan' },
  { to: '/import', label: '数据导入', icon: 'upload' },
  { to: '/audit', label: '操作日志', icon: 'list' },
  { to: '/account', label: '账号设置', icon: 'key' },
];

async function logout() {
  await adminApi.logout().catch(() => {});
  session.user = null;
  router.replace('/login');
}
</script>

<template>
  <RouterView v-if="route.meta.public" />
  <div v-else-if="session.user" class="adm">
    <nav class="side">
      <div class="brand-sm">juvelook<span class="reg">®</span></div>
      <div class="sub">认证查询 · 运营后台</div>
      <RouterLink v-for="n in NAV" :key="n.to" :to="n.to" class="nav-a"><Icon :name="n.icon" />{{ n.label }}</RouterLink>
      <div class="spacer"></div>
      <a class="nav-a" href="./" target="_blank" rel="noopener"><Icon name="home" />查看前台</a>
      <button class="nav-a btn link" style="justify-content: flex-start" type="button" @click="logout"><Icon name="logout" />退出登录</button>
      <div class="who">当前账号 <b>{{ session.user.username }}</b></div>
    </nav>
    <main class="main"><RouterView /></main>
  </div>

  <Modal v-if="confirmBox.open" :title="confirmBox.title" width="420px" @close="confirmBox.close(false)">
    <p style="margin: 0; color: var(--ink-soft); line-height: 1.7">{{ confirmBox.text }}</p>
    <template #footer>
      <button class="btn" type="button" @click="confirmBox.close(false)">取消</button>
      <button class="btn primary" :class="{ 'danger solid': confirmBox.danger }" type="button" @click="confirmBox.close(true)">{{ confirmBox.okText }}</button>
    </template>
  </Modal>

  <div class="adm-toast" :class="[toast.kind, { on: toast.msg }]" role="status">{{ toast.msg }}</div>
</template>

<style>
.adm-toast {
  position: fixed; left: 50%; top: 22px; transform: translate(-50%, -16px); background: var(--ink); color: var(--bg);
  padding: 10px 18px; border-radius: 22px; font-weight: 600; font-size: 13.5px; box-shadow: var(--shadow);
  opacity: 0; pointer-events: none; transition: .22s; z-index: 80;
}
.adm-toast.on { opacity: 1; transform: translate(-50%, 0); }
.adm-toast.err { background: var(--danger); color: #fff; }
</style>
