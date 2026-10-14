<script setup>
import { ref } from 'vue';
import { adminApi } from '../api.js';
import { session, toast } from '../store.js';

const form = ref({ old: '', next: '', again: '' });
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  const { old, next, again } = form.value;
  if (next.length < 8) return (error.value = '新密码至少 8 位');
  if (next !== again) return (error.value = '两次输入的新密码不一致');
  busy.value = true;
  try {
    await adminApi.changePassword(old, next);
    form.value = { old: '', next: '', again: '' };
    toast.show('密码已修改，其他设备上的登录已失效');
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page-hd"><h1>账号设置</h1></div>
  <div class="panel" style="max-width: 440px">
    <h2>修改密码</h2>
    <p class="muted" style="margin: -6px 0 16px; font-size: 13px; color: var(--ink-faint)">
      当前账号：{{ session.user.username }}{{ session.user.lastLoginAt ? ` · 上次登录 ${session.user.lastLoginAt}` : '' }}
    </p>
    <form style="display: flex; flex-direction: column; gap: 14px" @submit.prevent="submit">
      <div class="f"><label>原密码</label><input v-model="form.old" class="input" type="password" autocomplete="current-password" /></div>
      <div class="f"><label>新密码</label><input v-model="form.next" class="input" type="password" autocomplete="new-password" /><div class="help">至少 8 位</div></div>
      <div class="f"><label>确认新密码</label><input v-model="form.again" class="input" type="password" autocomplete="new-password" /></div>
      <p v-if="error" style="color: var(--danger); font-size: 13px; margin: 0">{{ error }}</p>
      <div><button class="btn primary" type="submit" :disabled="busy">保存</button></div>
    </form>
  </div>
</template>
