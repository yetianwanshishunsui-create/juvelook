<script setup>
import { defineAsyncComponent } from 'vue';

// 测试版才加载测试面板；正式构建中 VITE_DEMO 为空，整段被移除
const TestPanel = import.meta.env.VITE_DEMO ? defineAsyncComponent(() => import('./components/TestPanel.vue')) : null;
</script>

<template>
  <div class="wrap">
    <RouterView v-slot="{ Component }">
      <KeepAlive include="HomeView">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
  <component :is="TestPanel" v-if="TestPanel" />
</template>
