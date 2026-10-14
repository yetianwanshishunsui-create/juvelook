<script setup>
import { useRouter } from 'vue-router';
import Icon from '../../components/Icon.vue';
import { adminApi } from '../api.js';
import { session } from '../store.js';
import { H5_URL } from '../../api.js';

const router = useRouter();
async function logout() {
  await adminApi.logout().catch(() => {});
  session.user = null;
  router.replace('/login');
}
</script>

<template>
  <div class="page-hd"><h1>更多</h1></div>
  <div class="menu">
    <RouterLink to="/import" class="mi"><Icon name="upload" /><span>数据导入</span><Icon name="chev" class="chev" /></RouterLink>
    <RouterLink to="/audit" class="mi"><Icon name="list" /><span>操作日志</span><Icon name="chev" class="chev" /></RouterLink>
    <RouterLink to="/account" class="mi"><Icon name="key" /><span>账号设置</span><Icon name="chev" class="chev" /></RouterLink>
    <a :href="H5_URL" class="mi"><Icon name="home" /><span>查看前台</span><Icon name="chev" class="chev" /></a>
  </div>
  <div class="menu">
    <button type="button" class="mi danger" @click="logout"><Icon name="logout" /><span>退出登录</span></button>
  </div>
  <p class="who">当前账号 {{ session.user?.username }}</p>
</template>

<style scoped>
.menu { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; margin-bottom: 14px; }
.mi {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: none; border-bottom: 1px solid var(--line);
  background: none; width: 100%; font: inherit; font-size: 15px; font-weight: 600; color: var(--ink); cursor: pointer; text-align: left;
}
.mi:last-child { border-bottom: none; }
.mi span { flex: 1; }
.mi .icon { color: var(--accent); }
.mi.danger, .mi.danger .icon { color: var(--danger); }
.who { text-align: center; color: var(--ink-faint); font-size: 12.5px; }
</style>
