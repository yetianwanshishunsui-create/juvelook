<script setup>
import { useRouter } from 'vue-router';
import Icon from './Icon.vue';

defineProps({ title: { type: String, required: true } });
const router = useRouter();
// 从分享链接直接进入详情页时没有上一页，返回键回到首页
const back = () => (window.history.state?.back ? router.back() : router.replace('/'));
</script>

<template>
  <div class="topbar">
    <button class="tb-btn" type="button" aria-label="返回" @click="back"><Icon name="back" class="ic-18" /></button>
    <span class="tb-title">{{ title }}</span>
    <button class="tb-btn" type="button" aria-label="首页" @click="router.push('/')"><Icon name="home" class="ic-18" /></button>
  </div>
</template>

<style scoped>
.ic-18 { width: 18px; height: 18px; }
</style>
