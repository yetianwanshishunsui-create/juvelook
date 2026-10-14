<script setup>
import Icon from './Icon.vue';
defineProps({
  icon: { type: String, default: 'search' },
  title: { type: String, required: true },
  text: { type: String, default: '' },
});
</script>

<template>
  <div class="state" role="status">
    <div class="ic"><Icon :name="icon" style="width: 26px; height: 26px" /></div>
    <h3>{{ title }}</h3>
    <p v-if="text" style="white-space: pre-line">{{ text }}</p>
    <slot />
  </div>
</template>
