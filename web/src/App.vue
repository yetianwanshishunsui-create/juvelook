<script setup>
import { IS_DEMO } from './api.js';
</script>

<template>
  <div v-if="IS_DEMO" class="demo-bar">在线演示 · 虚拟数据，仅保存在本机浏览器 · <a href="./">返回演示首页</a></div>
  <div class="wrap">
    <RouterView v-slot="{ Component }">
      <KeepAlive include="HomeView">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
</template>

<style>
.demo-bar {
  text-align: center; font-size: 11.5px; font-weight: 600; color: var(--accent-deep); background: var(--accent-wash);
  padding: 6px 16px; border-bottom: 1px solid var(--line);
}
.demo-bar a { text-decoration: underline; }
</style>
