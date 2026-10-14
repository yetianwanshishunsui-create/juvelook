<script setup>
import { computed } from 'vue';
const props = defineProps({ total: Number, page: Number, size: Number });
const emit = defineEmits(['go']);
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)));
</script>

<template>
  <div class="pager">
    <span>共 {{ total }} 条</span>
    <div class="btns">
      <button class="btn sm" type="button" :disabled="page <= 1" @click="emit('go', page - 1)">上一页</button>
      <span>{{ page }} / {{ pages }}</span>
      <button class="btn sm" type="button" :disabled="page >= pages" @click="emit('go', page + 1)">下一页</button>
    </div>
  </div>
</template>
