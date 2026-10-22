<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import ScanImport from '../components/ScanImport.vue';
import ProfileImport from '../components/ProfileImport.vue';

const route = useRoute();
const tab = ref(route.query.tab === 'profile' ? 'profile' : 'scans');
</script>

<template>
  <div class="page-hd"><h1>数据导入</h1></div>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="tab === 'scans'" :class="{ on: tab === 'scans' }" @click="tab = 'scans'">小程序扫码数据</button>
    <button type="button" role="tab" :aria-selected="tab === 'profile'" :class="{ on: tab === 'profile' }" @click="tab = 'profile'">医生 / 机构资料</button>
  </div>
  <ScanImport v-if="tab === 'scans'" />
  <ProfileImport v-else />
</template>

<style scoped>
.tabs { display: inline-flex; gap: 4px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 4px; margin-bottom: 16px; max-width: 100%; }
.tabs button { border: none; background: none; font: inherit; font-weight: 600; font-size: 14px; color: var(--ink-soft); padding: 8px 14px; border-radius: 9px; cursor: pointer; white-space: nowrap; }
.tabs button.on { background: var(--surface); color: var(--accent-deep); box-shadow: var(--shadow-soft); }
</style>
