<script setup>
import Icon from './Icon.vue';
defineProps({ text: { type: String, default: '已认证' } });
</script>

<template>
  <span class="pill"><Icon name="check" style="width: 11px; height: 11px" />{{ text }}</span>
</template>
