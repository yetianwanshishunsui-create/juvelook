<script setup>
// 两品类支数格：值为 null 表示所在机构未授权该品类
import { PRODUCT } from '../api.js';
defineProps({ counts: { type: Object, required: true } });
</script>

<template>
  <div class="stats">
    <div v-for="k in ['blue', 'black']" :key="k" class="stat" :class="k">
      <div class="lab"><span class="cap" :class="k"></span>{{ PRODUCT[k] }}</div>
      <div v-if="counts[k] === null" class="na">未授权</div>
      <div v-else class="num">{{ counts[k].toLocaleString() }}<span class="unit">支</span></div>
    </div>
  </div>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); border-top: 1px solid var(--line); }
.stat { background: var(--surface); padding: 17px 18px; min-width: 0; }
.lab { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-soft); font-weight: 600; white-space: nowrap; }
.num {
  font-weight: 700; font-size: 33px; line-height: 1.1; margin-top: 9px;
  font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 4px;
}
.stat.blue .num { color: var(--blue); }
.stat.black .num { color: var(--black); }
.unit { font-size: 14px; font-weight: 500; color: var(--ink-faint); }
.na { color: var(--ink-faint); font-size: 16px; font-weight: 500; margin-top: 12px; }
</style>
