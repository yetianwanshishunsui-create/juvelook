<script setup>
import { IC } from '../icons.js';
defineProps({ name: { type: String, required: true } });
</script>

<template>
  <span class="icon" v-html="IC[name]"></span>
</template>

<style scoped>
.icon { display: inline-grid; place-items: center; line-height: 0; width: 18px; height: 18px; flex: none; }
.icon :deep(svg) { width: 100%; height: 100%; }
</style>
