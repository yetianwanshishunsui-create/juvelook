<script setup>
import { api } from '../api.js';
import { useDetail } from '../useDetail.js';
import Icon from '../components/Icon.vue';
import TopBar from '../components/TopBar.vue';
import VerifiedPill from '../components/VerifiedPill.vue';
import BottleStats from '../components/BottleStats.vue';
import StateBlock from '../components/StateBlock.vue';

const { data: d, error, loading, reload } = useDetail(api.doctor);
</script>

<template>
  <TopBar title="医生详情" />

  <div v-if="loading" class="skel tall" aria-busy="true"></div>

  <StateBlock v-else-if="error?.status === 404" icon="none" title="未找到该医生" text="该医生可能尚未认证或认证已失效" />
  <StateBlock v-else-if="error" icon="alert" title="加载失败" :text="error.message">
    <div class="chips"><button type="button" class="chip" @click="reload">重试</button></div>
  </StateBlock>

  <template v-else-if="d">
    <article class="card">
      <div class="dhero">
        <div class="dava">{{ d.name[0] }}</div>
        <div style="flex: 1; min-width: 0">
          <div class="dname">{{ d.name }} <VerifiedPill /></div>
          <div class="dmeta"><Icon name="doc" /><span>juvelook 品牌认证注射医生{{ d.city ? ` · ${d.city}` : '' }}</span></div>
          <div v-if="d.code" class="dcode">认证编号 {{ d.code }}</div>
        </div>
      </div>

      <RouterLink :to="`/org/${d.org.id}`" class="linkrow">
        <div class="li-ic"><Icon name="org" style="width: 17px; height: 17px" /></div>
        <div class="li-main">
          <div class="li-lab">所在机构</div>
          <div class="li-val">{{ d.org.name }}</div>
        </div>
        <Icon name="chev" class="chev" />
      </RouterLink>

      <div class="sect-lab"><span>累计注射支数</span></div>
      <BottleStats :counts="d.counts" />
    </article>
    <p class="foot">点击「所在机构」可查看该机构的授权与团队</p>
  </template>
</template>

<style scoped>
.linkrow {
  display: flex; align-items: center; gap: 11px; margin: 0 20px 4px; padding: 13px 15px;
  background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; transition: .15s;
}
.linkrow:active { border-color: var(--accent); background: var(--accent-wash); }
.li-ic {
  width: 34px; height: 34px; border-radius: 10px; background: var(--surface); display: grid; place-items: center;
  color: var(--accent); flex: none; border: 1px solid var(--line);
}
.li-main { flex: 1; min-width: 0; }
.li-lab { font-size: 11px; color: var(--ink-faint); font-weight: 600; }
.li-val { font-size: 14.5px; font-weight: 600; margin-top: 1px; overflow-wrap: anywhere; }
</style>
