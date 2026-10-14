<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adminApi } from '../api.js';
import { session } from '../store.js';
import { IS_DEMO } from '../../api.js';

const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  if (!username.value || !password.value) return (error.value = '请输入账号和密码');
  busy.value = true;
  try {
    session.user = await adminApi.login(username.value.trim(), password.value);
    const next = String(route.query.next || '/');
    router.replace(next.startsWith('/') ? next : '/');
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <div class="brand-sm">juvelook<span class="reg">®</span></div>
      <h1>运营后台登录</h1>
      <p v-if="IS_DEMO" class="demo-hint">演示账号 <b>admin</b> · 密码 <b>juvelook-demo</b></p>
      <div class="f">
        <label for="u">账号</label>
        <input id="u" v-model="username" class="input" autocomplete="username" autofocus />
      </div>
      <div class="f">
        <label for="p">密码</label>
        <input id="p" v-model="password" class="input" type="password" autocomplete="current-password" />
      </div>
      <p v-if="error" class="login-err" role="alert">{{ error }}</p>
      <button class="btn primary" type="submit" :disabled="busy">{{ busy ? '登录中…' : '登录' }}</button>
    </form>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
.login-card {
  width: 100%; max-width: 360px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px;
  box-shadow: var(--shadow); padding: 28px 26px; display: flex; flex-direction: column; gap: 14px;
}
h1 { font-size: 20px; margin: 4px 0 6px; }
.btn { padding: 11px; font-size: 15px; margin-top: 4px; }
.demo-hint { margin: -6px 0 0; font-size: 13px; color: var(--accent-deep); background: var(--accent-wash); padding: 8px 12px; border-radius: 10px; }
.login-err { color: var(--danger); font-size: 13px; margin: -4px 0 0; }
</style>
