<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import Icon from '../../components/Icon.vue';

defineProps({ title: String, width: { type: String, default: '560px' } });
const emit = defineEmits(['close']);
const onKey = (e) => e.key === 'Escape' && emit('close');
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="m-overlay" @mousedown.self="emit('close')">
    <div class="m-box" role="dialog" aria-modal="true" :style="{ maxWidth: width }">
      <div class="m-hd">
        <h3>{{ title }}</h3>
        <button class="m-x" type="button" aria-label="关闭" @click="emit('close')"><Icon name="close" /></button>
      </div>
      <div class="m-bd"><slot /></div>
      <div v-if="$slots.footer" class="m-ft"><slot name="footer" /></div>
    </div>
  </div>
</template>

<style>
.m-overlay { position: fixed; inset: 0; background: rgba(10, 16, 24, .45); display: grid; place-items: center; padding: 16px; z-index: 60; }
.m-box { background: var(--surface); width: 100%; border-radius: 16px; box-shadow: var(--shadow); max-height: calc(100vh - 32px); display: flex; flex-direction: column; animation: rise .2s ease both; }
.m-hd { display: flex; align-items: center; padding: 16px 20px 10px; }
.m-hd h3 { flex: 1; margin: 0; font-size: 17px; }
.m-x { border: none; background: none; color: var(--ink-faint); cursor: pointer; padding: 4px; display: grid; }
.m-bd { padding: 8px 20px 4px; overflow: auto; }
.m-ft { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px 18px; }
/* 手机：从底部弹出 */
@media (max-width: 700px) {
  .m-overlay { place-items: end stretch; padding: 0; }
  .m-box { max-width: none !important; border-radius: 18px 18px 0 0; max-height: 92vh; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .m-ft .btn { flex: 1; padding: 11px; }
}
</style>
